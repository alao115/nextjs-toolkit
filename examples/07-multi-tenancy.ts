/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 07 — Multi-tenancy.
 *
 * Shows:
 *  - Tenant id flows in via `x-tenant-id` header (set by RequestContextInterceptor).
 *  - `TenantService.scopedWhere()` prevents accidental cross-tenant reads.
 *  - Cache + rate-limit keys composed with tenant scope.
 *  - Background jobs explicitly seed a tenant context.
 */

import { Controller, Get, Injectable, Module, Query } from "@nestjs/common";
import {
	RequestContext,
	RequestContextService,
} from "@alaska115/nextjs-toolkit/context";
import { TenantModule, TenantService } from "@alaska115/nextjs-toolkit/multi-tenancy";
import { CacheStoreService } from "@alaska115/nextjs-toolkit/cache";

declare const prisma: any;

@Module({
	imports: [TenantModule], // @Global — TenantService available everywhere
})
export class TenantExampleModule {}

// ─── Repository: every query is tenant-scoped ────────────────────────────

@Injectable()
export class UserRepository {
	constructor(private readonly tenant: TenantService) {}

	listByName(q: string) {
		// `scopedWhere` throws TenantNotSetError if no tenant is on the
		// request context — the right failure mode for endpoints that
		// should never serve cross-tenant data.
		return prisma.user.findMany({
			where: this.tenant.scopedWhere({ name: { contains: q } }),
		});
	}

	// Public endpoints that legitimately serve cross-tenant data are
	// rare — be explicit when you do it.
	listPublicCatalog() {
		return prisma.product.findMany({
			where: this.tenant.scopedWhere({ public: true }, { strict: false }),
		});
	}
}

// ─── Service: tenant-scoped caching ──────────────────────────────────────

@Injectable()
export class UserCache {
	constructor(
		private readonly tenant: TenantService,
		private readonly cache: CacheStoreService,
	) {}

	async getUser(id: string): Promise<unknown> {
		// Cache key: "t:acme:user:42" — no key collisions across tenants.
		const key = this.tenant.cacheKey("user", id);
		const hit = await this.cache.storeInstance.get<unknown>(key);
		if (hit) return hit;
		// ... fetch from db ...
		return null;
	}
}

// ─── Controller — explicit tenant resolution at edge ─────────────────────

@Controller("/users")
export class UserController {
	constructor(private readonly repo: UserRepository) {}

	@Get()
	list(@Query("q") q: string) {
		// `RequestContextInterceptor` has already read `x-tenant-id` from
		// the request and stored it on the active RequestContext.
		// The repo `scopedWhere` will use it automatically.
		return this.repo.listByName(q);
	}
}

// ─── Background jobs: explicitly seed tenant context ─────────────────────

@Injectable()
export class TenantWorker {
	constructor(
		private readonly ctxService: RequestContextService,
		private readonly repo: UserRepository,
	) {}

	/**
	 * A queue consumer runs OUTSIDE an HTTP request, so there's no
	 * RequestContext by default. You must seed one before calling
	 * tenant-aware code, or `scopedWhere` will throw `TenantNotSetError`.
	 */
	async handleJob(job: { tenantId: string; userId: string }) {
		const ctx = new RequestContext({
			tenantId: job.tenantId,
			userId: job.userId,
		});
		await this.ctxService.runWithContext(ctx, async () => {
			// Inside this block, repo / cache / audit / flags all see the
			// tenant id as if it had come from an HTTP request.
			await this.repo.listByName("");
		});
	}
}
