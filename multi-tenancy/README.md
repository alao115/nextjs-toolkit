# `@alaska115/nextjs-toolkit/multi-tenancy`

Tenant-aware primitives that compose the active `RequestContext.tenantId` into cache keys, rate-limit keys, and database `where` clauses.

## Wire it up

```ts
import { TenantModule } from "@alaska115/nextjs-toolkit/multi-tenancy";

@Module({ imports: [TenantModule] })
export class AppModule {}
```

`TenantModule` is `@Global()` so `TenantService` is available everywhere without re-importing.

The tenant id flows in via `RequestContextInterceptor`, which reads:
1. `x-tenant-id` request header, or
2. `req.user.tenantId` (whatever your auth guard attaches).

## Usage

```ts
constructor(private readonly tenant: TenantService) {}

// Hard isolation in cache keys
const cacheKey = this.tenant.cacheKey("user", userId);   // "t:acme:user:42"

// Composite rate-limit key
const rlKey = this.tenant.rateLimitKey("api", "POST", "/users"); // "acme:api:POST:/users"

// Database where-clause enforcement
const users = await prisma.user.findMany({
  where: this.tenant.scopedWhere({ email: { contains: q } }),
});
// → where: { email: { contains: q }, tenantId: "acme" }
```

`scopedWhere` throws `TenantNotSetError` by default when no tenant is on the context — that's the **right** failure mode for endpoints that should never run untenanted. Pass `{ strict: false }` for endpoints that legitimately serve global data (e.g. health checks, public catalogs).

## Anti-patterns

- **Don't read `RequestContext.tenantId` directly in domain code.** Use `TenantService` so missing-tenant behavior is consistent.
- **Don't `scopedWhere({ strict: false })` "to be safe".** Soft mode is for endpoints that explicitly serve cross-tenant data, not for endpoints whose author was unsure. Be explicit.
- **Background jobs** must seed the request context before calling tenant-aware code (`ctxService.runWithContext(new RequestContext({ tenantId }), fn)`). The package can't infer tenancy from a queue message header for you.
