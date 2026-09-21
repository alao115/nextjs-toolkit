# `utils`

```ts
import {
  // pagination
  PaginationQueryDto, TogglePaginationEnum,
  buildPaginationQueryArgs, buildPaginatedResult,
  buildWhere, buildOrderBy, buildInclude,
  type PaginationQueryInput, type PaginationConfig, type PaginatedResult,
  type PrismaPaginationArgs, type OrderByInput, type OrderDirection,
  // misc
  catchError, minutesFromNow, resolveAssets,
} from "@alaska115/nextjs-toolkit/utils";
```

Prisma-flavoured pagination builders plus a few small helpers.

## Pagination

```ts
@Get()
async list(@Query() query: PaginationQueryDto) {
  const config: PaginationConfig = {
    search: ["name", "email"],          // fields for the `search` term (OR, case-insensitive)
    dateAttr: "createdAt",              // field the `from`/`to` range applies to
    orderBy: { createdAt: "desc" },     // fallback order when `sort` is absent
    includes: ["profile", "orders.items"],
    baseWhere: { deletedAt: null },     // tenant scope, soft-delete filter, …
  };

  const args = buildPaginationQueryArgs(query, config);
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where: args.where, take: args.take, skip: args.skip,
                           orderBy: args.orderBy, include: args.include }),
    prisma.user.count({ where: args.where }),
  ]);

  return buildPaginatedResult({ items, total, page: query.page ?? 1, limit: query.limit ?? 10 });
}
```

### `PaginationQueryDto` / `PaginationQueryInput`

| Query param        | Type                     | Meaning                                    |
| ------------------ | ------------------------ | ------------------------------------------ |
| `page`             | `number`                 | 1-based; invalid or missing → `1`.         |
| `limit`            | `number`                 | Invalid or missing → `10`.                 |
| `search`           | `string`                 | Matched against `config.search` fields.    |
| `sort`             | `string`                 | `"field:dir,field2:dir"`, e.g. `"createdAt:desc,name:asc"`. |
| `from` / `to`      | `Date`                   | Range on `config.dateAttr`.                |
| `enablePagination` | `"enable" \| "disable"`  | `TogglePaginationEnum`.                    |

`PaginationQueryDto` is a class — add your own `class-validator` decorators in a
subclass if you want stricter bounds (e.g. `limit <= 100`).

### `buildPaginationQueryArgs(query, config)`

Returns `{ where, take, skip, limit, offset, orderBy?, include? }`. Both naming
conventions are present so the result drops straight into Prisma (`take`/`skip`)
or into a raw SQL layer (`limit`/`offset`).

Composed from three builders you can also call directly:

- **`buildWhere`** — starts from `config.baseWhere`, adds an `OR` of
  `{ [field]: { contains, mode: "insensitive" } }` for each search field, then a
  `gte`/`lte` range on `config.dateAttr`.
- **`buildOrderBy`** — parses `query.sort` (`"field:dir"`, comma-separated);
  falls back to `config.orderBy`. Returns a single object for one field, an
  array for several (what Prisma wants for multi-key ordering).
- **`buildInclude`** — turns `["profile", "orders.items"]` into a nested Prisma
  include tree.

> Two sharp edges. `buildWhere` **overwrites** `where.OR` when a search term is
> present, so an `OR` inside `baseWhere` is lost — nest it under `AND` instead.
> And `sort` and `search` field names go through unvalidated: restrict them to a
> known list before passing user input to `config`, or a client can order by any
> column in the table.
>
> `enablePagination` is carried on the DTO but not read by any builder — honour
> it in your own handler if you expose it.

### `buildPaginatedResult({ items, total, page, limit })`

```json
{
  "items": [],
  "meta": { "page": 1, "limit": 10, "totalItems": 0, "totalPages": 1,
            "hasNext": false, "hasPrev": false }
}
```

`totalPages` is at least `1`, even for an empty result.

## Helpers

### `catchError`

```ts
const [err, user] = await catchError(this.userService.findById(id));
if (err) return this.handle(err);   // err.status / err.details are typed
use(user);
```

Go-style error tuple: `[undefined, T]` on success, `[Error & { status, details }, undefined]`
on failure. Use it where a failure is an expected branch; keep `throw` for
genuine exceptions so [`HttpExceptionFilter`](./errors.md) can shape the
response.

### `minutesFromNow(minutes = 10)`

A `Date` that many minutes in the future — for token and OTP expiries.

### `resolveAssets(relativePath)`

`path.join(__dirname, relativePath)` **relative to the package's own `dist`
directory**, not your application. Useful only for assets shipped inside the
package; use your own `__dirname` for your own files.

## Not exported

`AppResponse` and `BaseCrudController` live under `utils/resource/` but are not
re-exported from the `/utils` entrypoint, so you cannot import them today —
even though `GlobalResponseInterceptor` uses `AppResponse` to shape every
successful response. If you need the envelope type on the client side, declare
it yourself:

```ts
interface AppResponse<T> {
  success: boolean;
  timestamp: string;
  correlationId: string;
  data?: T;
  error?: unknown;
}
```
