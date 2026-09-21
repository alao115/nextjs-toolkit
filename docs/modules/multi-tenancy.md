# `multi-tenancy`

> **Experimental** — the API may change before 1.0.

```ts
import {
  TenantModule,
  TenantService,
  TenantNotSetError,
} from "@alaska115/nextjs-toolkit/multi-tenancy";
```

Helpers for tenant-aware code paths. The tenant id itself comes from the
[request context](./context.md) — the `x-tenant-id` header, or `req.user.tenantId`
attached by your auth guard.

## Setup

```ts
@Module({ imports: [TenantModule] })   // provides + exports TenantService
export class AppModule {}
```

`TenantModule` needs `RequestContextService`, which is available globally once
any of `ContextModule` / `LoggerModule` / `TracingModule` / `MetricsModule` is
imported — and `RequestContextInterceptor` must be registered, or the context
will always be empty.

## `TenantService`

| Method                          | Behaviour                                                                |
| ------------------------------- | ------------------------------------------------------------------------ |
| `current()`                     | The tenant id, or `undefined`.                                           |
| `require(op?)`                  | The tenant id, or throws `TenantNotSetError` naming `op`.                |
| `cacheKey(...parts)`            | `` `t:${tenant \|\| "global"}:${parts.join(":")}` ``                       |
| `rateLimitKey(...parts)`        | `` `${tenant \|\| "global"}:${parts.join(":")}` ``                         |
| `scopedWhere(where?, options?)` | Adds the tenant column to a Prisma `where`.                              |

```ts
// hard-fail a write that has no tenant
const tenantId = this.tenant.require("createInvoice");

// tenant-isolated cache keys
await cache.set(this.tenant.cacheKey("invoice", id), invoice);

// tenant-scoped query
await prisma.invoice.findMany({ where: this.tenant.scopedWhere({ status: "open" }) });
```

### `scopedWhere`

```ts
scopedWhere(where = {}, { strict = true, column = "tenantId" } = {})
```

Returns `{ ...where, [column]: tenantId }`. **Strict by default**: with no
tenant on the context it throws `TenantNotSetError` rather than returning an
unscoped query. Pass `strict: false` only where a cross-tenant read is genuinely
intended (admin tooling, background reconciliation) — and say so at the call
site.

Use `column` when your schema names the discriminator something else
(`organizationId`, `workspace_id`).

## Notes

- `cacheKey` and `rateLimitKey` fall back to the literal `"global"` when no
  tenant is set, so single-tenant deployments still get a stable namespace.
  `scopedWhere` deliberately does **not** do that — a missing tenant in a query
  is a bug, not a default.
- Nothing here enforces isolation at the database level. Combine it with
  row-level security or separate schemas if you need a guarantee rather than a
  convention.
- For background jobs, open a request context yourself (see
  [`context`](./context.md#requestcontextservice)) so `TenantService` resolves.

See [`examples/07-multi-tenancy.ts`](../../examples/07-multi-tenancy.ts).
