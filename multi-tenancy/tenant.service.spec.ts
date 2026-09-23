import { TenantService, TenantNotSetError } from "./tenant.service.js";
import { RequestContext } from "../context/request-context.js";
import { RequestContextService } from "../context/request-context.service.js";

/** Runs `fn` inside a request context carrying `tenantId`. */
function withTenant<T>(
	tenantId: string | undefined,
	fn: (tenant: TenantService) => T,
): T {
	const ctxService = new RequestContextService();
	const tenant = new TenantService(ctxService);
	return ctxService.runWithContext(
		new RequestContext({ tenantId, requestId: "r1", correlationId: "c1" }),
		() => fn(tenant),
	);
}

/** A TenantService with no surrounding request context at all. */
function withoutContext<T>(fn: (tenant: TenantService) => T): T {
	return fn(new TenantService(new RequestContextService()));
}

describe("current", () => {
	it("returns the tenant from the request context", () => {
		expect(withTenant("acme", (t) => t.current())).toBe("acme");
	});

	it("returns undefined when the context has no tenant", () => {
		expect(withTenant(undefined, (t) => t.current())).toBeUndefined();
	});

	it("returns undefined outside a request context", () => {
		expect(withoutContext((t) => t.current())).toBeUndefined();
	});
});

describe("require", () => {
	it("returns the tenant when set", () => {
		expect(withTenant("acme", (t) => t.require())).toBe("acme");
	});

	it("throws TenantNotSetError when unset", () => {
		expect(() => withTenant(undefined, (t) => t.require())).toThrow(
			TenantNotSetError,
		);
	});

	it("names the operation in the message", () => {
		expect(() => withTenant(undefined, (t) => t.require("createInvoice"))).toThrow(
			/createInvoice/,
		);
	});

	it("throws outside a request context", () => {
		expect(() => withoutContext((t) => t.require())).toThrow(TenantNotSetError);
	});
});

describe("cacheKey", () => {
	it("prefixes with the tenant", () => {
		expect(withTenant("acme", (t) => t.cacheKey("invoice", "42"))).toBe(
			"t:acme:invoice:42",
		);
	});

	it("falls back to the global namespace when no tenant is set", () => {
		expect(withTenant(undefined, (t) => t.cacheKey("invoice"))).toBe(
			"t:global:invoice",
		);
	});

	it("isolates two tenants' keys for the same resource", () => {
		const a = withTenant("acme", (t) => t.cacheKey("invoice", "42"));
		const b = withTenant("globex", (t) => t.cacheKey("invoice", "42"));
		expect(a).not.toBe(b);
	});

	it("works with no parts", () => {
		expect(withTenant("acme", (t) => t.cacheKey())).toBe("t:acme");
	});
});

describe("rateLimitKey", () => {
	it("prefixes with the tenant, without the cache sigil", () => {
		expect(withTenant("acme", (t) => t.rateLimitKey("u1", "/orders"))).toBe(
			"acme:u1:/orders",
		);
	});

	it("falls back to the global namespace", () => {
		expect(withTenant(undefined, (t) => t.rateLimitKey("u1"))).toBe("global:u1");
	});

	it("gives two tenants separate budgets", () => {
		expect(withTenant("acme", (t) => t.rateLimitKey("u1"))).not.toBe(
			withTenant("globex", (t) => t.rateLimitKey("u1")),
		);
	});
});

describe("scopedWhere", () => {
	it("adds the tenant discriminator", () => {
		expect(withTenant("acme", (t) => t.scopedWhere({ status: "open" }))).toEqual({
			status: "open",
			tenantId: "acme",
		});
	});

	it("scopes an empty where", () => {
		expect(withTenant("acme", (t) => t.scopedWhere())).toEqual({
			tenantId: "acme",
		});
	});

	it("does not mutate the caller's object", () => {
		const where = { status: "open" };
		withTenant("acme", (t) => t.scopedWhere(where));
		expect(where).toEqual({ status: "open" });
	});

	it("honours a custom column name", () => {
		expect(
			withTenant("acme", (t) => t.scopedWhere({}, { column: "organizationId" })),
		).toEqual({ organizationId: "acme" });
	});

	// The load-bearing case: an unscoped query must never silently escape.
	it("throws rather than returning an unscoped query when no tenant is set", () => {
		expect(() => withTenant(undefined, (t) => t.scopedWhere({ status: "open" }))).toThrow(
			TenantNotSetError,
		);
	});

	it("throws outside a request context", () => {
		expect(() => withoutContext((t) => t.scopedWhere())).toThrow(TenantNotSetError);
	});

	it("returns the where unscoped only when strict is explicitly false", () => {
		expect(
			withTenant(undefined, (t) =>
				t.scopedWhere({ status: "open" }, { strict: false }),
			),
		).toEqual({ status: "open" });
	});

	it("overrides an attacker-supplied tenantId in the where clause", () => {
		expect(
			withTenant("acme", (t) => t.scopedWhere({ tenantId: "globex" })),
		).toEqual({ tenantId: "acme" });
	});
});
