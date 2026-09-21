# `context`

```ts
import {
  ContextModule,
  RequestContext,
  RequestContextService,
  RequestContextInterceptor,
  GlobalResponseInterceptor,
  type RequestContextValues,
} from "@alaska115/nextjs-toolkit/context";
```

Per-request scope built on `AsyncLocalStorage`. Everything else in the toolkit
that says "auto-enriched with correlation ids" reads from here — the logger,
tracer, metrics labels, audit actor resolution, tenant scoping and the
rate-limit key builder.

See [ADR 0004](../adr/0004-request-context-als.md) for why ALS instead of
request-scoped providers.

## Setup

`ContextModule` is `@Global()` and is imported transitively by `LoggerModule`,
`TracingModule` and `MetricsModule`. If you import any of those, you already
have `RequestContextService` — **do not re-provide it**, or you'll create a
second ALS instance and the interceptor's context will be invisible to the
services reading it.

You still have to register the interceptor that opens the scope:

```ts
import { APP_INTERCEPTOR } from "@nestjs/core";

@Module({
  imports: [ContextModule], // or LoggerModule / TracingModule / MetricsModule
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor }, // optional
  ],
})
export class AppModule {}
```

[`ObservabilityModule.forRoot()`](./observability.md) registers both for you.

## `RequestContextValues`

| Field           | Source                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| `requestId`     | `x-request-id` header, else a new UUID                                    |
| `correlationId` | `x-kong-request-id`, else `x-correlation-id`, else a new UUID             |
| `traceId`       | `traceparent` header, else `correlationId`                                |
| `spanId`        | optional, set by the tracing adapter                                      |
| `userId`        | `req.user?.id` (whatever your auth guard attached)                        |
| `tenantId`      | `x-tenant-id` header, else `req.user?.tenantId`                           |
| `ip`            | `req.ip`, else `req.socket.remoteAddress`                                 |
| `secured`       | `req.secure`                                                              |

`RequestContext` is a class implementing that interface; its constructor takes
a `Partial<RequestContextValues>`.

## `RequestContextService`

```ts
runWithContext<T>(ctx: RequestContext, fn: () => T): T
getContext(): RequestContext | undefined
```

`getContext()` returns `undefined` outside a request (cron jobs, queue
consumers, boot code). Every consumer in the toolkit treats that as a valid
state rather than an error — do the same in your code.

To carry context into a background job, open a scope yourself:

```ts
await ctx.runWithContext(
  new RequestContext({ requestId: jobId, correlationId: jobId, traceId: jobId, secured: false }),
  () => this.processJob(job),
);
```

## `RequestContextInterceptor`

Builds a `RequestContext` from the incoming request using the table above and
runs the rest of the handler inside it. Register it **first** among your
interceptors — anything registered before it runs outside the scope.

## `GlobalResponseInterceptor`

Wraps every successful response body in an envelope:

```json
{
  "success": true,
  "timestamp": "2026-09-20T10:11:12.000Z",
  "correlationId": "…",
  "data": { }
}
```

`StreamableFile` responses pass through untouched. Error responses are shaped by
[`HttpExceptionFilter`](./errors.md) instead, which uses a different, flatter
shape — account for both in your API clients.
