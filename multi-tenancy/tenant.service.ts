import { Injectable } from "@nestjs/common";
import { RequestContextService } from "../context";

/**
 * Thrown when code requires a tenant scope but none is set on the
 * current request context.
 */
export class TenantNotSetError extends Error {
	constructor(op?: string) {
		super(
			op
				? `Tenant id is required for operation "${op}" but not set on the request context`
				: "Tenant id is required but not set on the request context",
		);
		this.name = "TenantNotSetError";
	}
}

/**
 * Helpers for tenant-aware code paths. Reads the active tenant id from the
 * {@link RequestContextService} and composes scoped keys for caches, queues,
 * rate limiters, etc.
 */
@Injectable()
export class TenantService {
	constructor(private readonly ctx: RequestContextService) {}

	/** Returns the current tenant id, or `undefined` if not set. */
	current(): string | undefined {
		return this.ctx.getContext()?.tenantId;
	}

	/** Returns the current tenant id, throws if not set. */
	require(op?: string): string {
		const id = this.current();
		if (!id) throw new TenantNotSetError(op);
		return id;
	}

	/**
	 * Prefixes `key` with the current tenant id, so a cache that uses this
	 * helper has hard isolation between tenants out of the box.
	 *
	 * If no tenant is set, defaults to `"global"` so single-tenant deployments
	 * still get a stable namespace.
	 */
	cacheKey(...parts: string[]): string {
		const tenant = this.current() ?? "global";
		return [`t:${tenant}`, ...parts].join(":");
	}

	/**
	 * Composes a rate-limit key with the current tenant prefix. Combine with
	 * `:${userId}:${route}` etc. on the caller side.
	 */
	rateLimitKey(...parts: string[]): string {
		const tenant = this.current() ?? "global";
		return [tenant, ...parts].join(":");
	}

	/**
	 * Returns a Prisma-flavored `where` fragment that constrains a query to
	 * the current tenant. If no tenant is set and `strict` is true (default),
	 * throws — preventing accidental cross-tenant reads.
	 *
	 * ```ts
	 * await prisma.user.findMany({ where: tenant.scopedWhere({ email }) });
	 * ```
	 */
	scopedWhere<T extends Record<string, unknown>>(
		where: T = {} as T,
		options: { strict?: boolean; column?: string } = {},
	): T & { tenantId: string } {
		const strict = options.strict ?? true;
		const column = options.column ?? "tenantId";
		const tenant = this.current();
		if (!tenant) {
			if (strict) throw new TenantNotSetError("scopedWhere");
			return where as T & { tenantId: string };
		}
		return { ...where, [column]: tenant } as T & { tenantId: string };
	}
}
