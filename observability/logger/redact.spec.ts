import { redact } from "./redact";

describe("redact", () => {
	it("redacts default sensitive keys (case-insensitive)", () => {
		const input = {
			Authorization: "Bearer abc.def.ghi",
			"X-API-Key": "k_123",
			cookie: "sid=abc; secure",
			password: "hunter2",
			normal: "ok",
		};
		const out = redact(input);
		expect(out.Authorization).toBe("[REDACTED]");
		expect(out["X-API-Key"]).toBe("[REDACTED]");
		expect(out.cookie).toBe("[REDACTED]");
		expect(out.password).toBe("[REDACTED]");
		expect(out.normal).toBe("ok");
	});

	it("recurses into nested objects and arrays", () => {
		const input = {
			user: {
				name: "alice",
				credentials: { password: "x", token: "t" },
			},
			items: [{ secret: "s" }, { ok: true }],
		};
		const out = redact(input);
		expect(out.user.credentials.password).toBe("[REDACTED]");
		expect(out.user.credentials.token).toBe("[REDACTED]");
		expect(out.user.name).toBe("alice");
		expect((out.items[0] as any).secret).toBe("[REDACTED]");
		expect((out.items[1] as any).ok).toBe(true);
	});

	it("honors extraKeys and exceptKeys", () => {
		const out = redact(
			{ custom_pin: "1234", password: "p" },
			{ extraKeys: ["custom_pin"], exceptKeys: ["password"] },
		);
		expect(out.custom_pin).toBe("[REDACTED]");
		expect(out.password).toBe("p");
	});

	it("does not throw on null/undefined/primitive inputs", () => {
		expect(redact(null)).toBeNull();
		expect(redact(undefined)).toBeUndefined();
		expect(redact("hello" as any)).toBe("hello");
		expect(redact(42 as any)).toBe(42);
	});

	it("respects maxDepth (values past maxDepth are redacted)", () => {
		const deep: any = { a: { b: { c: { d: { e: { f: "leaf" } } } } } };
		const out = redact(deep, { maxDepth: 2 });
		// depth 0 = root, 1 = a, 2 = b. Values at depth > 2 get redacted,
		// so out.a.b.c (depth 3) is "[REDACTED]" while out.a.b still has its key.
		expect(out.a.b.c).toEqual("[REDACTED]");
	});

	it("does not mutate the input", () => {
		const input = { password: "p", a: { token: "t" } };
		const copy = JSON.parse(JSON.stringify(input));
		redact(input);
		expect(input).toEqual(copy);
	});
});
