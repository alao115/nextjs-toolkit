# `@alaska115/nextjs-toolkit/utils`

Small framework-free helpers. No DI, no NestJS — just functions you can `import` anywhere.

## Pagination

```ts
import {
  buildWhere,
  buildOrderBy,
  PaginationDto,
  paginateResults,
} from "@alaska115/nextjs-toolkit/utils";

@Get()
async list(@Query() query: PaginationDto) {
  const where = buildWhere(query, {
    baseWhere: { tenantId },
    search: ["name", "email"],
    dateAttr: "createdAt",
  });
  const orderBy = buildOrderBy(query, { orderBy: { createdAt: "desc" } });

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy, skip: query.offset, take: query.limit }),
    prisma.user.count({ where }),
  ]);

  return paginateResults(rows, total, query);
}
```

`buildWhere` composes a base where with search OR + date range. `buildOrderBy` parses `?sort=name:asc,createdAt:desc` into Prisma's expected shape. Both are pure functions; tests live next to them.

## Date / clock

```ts
import { minutesFromNow } from "@alaska115/nextjs-toolkit/utils";

const expiresAt = minutesFromNow(15); // Date 15 minutes ahead
```

## Resource helpers

```ts
import { AppResponse, BaseController } from "@alaska115/nextjs-toolkit/utils/resource";

return AppResponse.success(data, correlationId);
// → { ok: true, data, correlationId }
```

`AppResponse` is the canonical success envelope. `GlobalResponseInterceptor` wraps every successful controller return value in it automatically — you only call it directly for unusual shapes.

## `catchError`

```ts
import { catchError } from "@alaska115/nextjs-toolkit/utils";

const [err, user] = await catchError(userService.find(id));
if (err) { /* handle */ }
```

Go-style tuple destructuring instead of try/catch. Use for code paths where the error branch is **expected** business logic — e.g. "user might not exist." Don't use it to swallow programming errors.

## Anti-patterns

- **Don't add domain types here.** This module is intentionally framework-free and side-effect-free.
- **Don't add I/O helpers.** File reads, network calls, etc. belong in their own modules so they can be mocked.
- **Don't use `catchError` as a global try/catch replacement.** For unexpected errors, throw — let the `HttpExceptionFilter` shape the response.
