# `@alaska115/nextjs-toolkit/context`

`AsyncLocalStorage`-based request context. Carries `requestId`, `correlationId`, `traceId`, `spanId?`, `userId?`, `tenantId?`, `ip?`, `secured` across the async call stack of a single HTTP request — so logs, audit events, feature flags, rate limits, tenancy, and tracing can all read it without threading it through every signature.

See **[ADR 0004](../docs/adr/0004-request-context-als.md)** for the architectural reasoning.

## Wire it up

```ts
import {
  RequestContextInterceptor,
  GlobalResponseInterceptor,
  RequestContextService,
} from "@alaska115/nextjs-toolkit/context";
import { APP_INTERCEPTOR } from "@nestjs/core";

@Module({
  providers: [
    RequestContextService,
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },   // FIRST
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },   // wraps responses with correlationId
  ],
  exports: [RequestContextService],
})
export class ContextModule {}
```

If you import `ObservabilityModule.forRoot()`, both interceptors are already registered for you in the correct order — don't double-register.

## Read it

```ts
constructor(private readonly ctx: RequestContextService) {}

logAction() {
  const { tenantId, userId, correlationId } = this.ctx.getContext() ?? {};
  // ...
}
```

Returns `undefined` outside an active request (workers, cron jobs, init code) — code should always null-check.

## Set it for background work

```ts
import { RequestContext, RequestContextService } from "@alaska115/nextjs-toolkit/context";

async function processQueueMessage(msg: { tenantId: string; userId: string }) {
  const ctx = new RequestContext({
    tenantId: msg.tenantId,
    userId: msg.userId,
  });
  await ctxService.runWithContext(ctx, async () => {
    await businessLogic();  // sees tenant/user as if from an HTTP request
  });
}
```

## Header inputs

`RequestContextInterceptor` reads (in priority order):
- `x-kong-request-id` or `x-correlation-id` → `correlationId`
- `x-request-id` → `requestId`
- `traceparent` → `traceId`
- `x-tenant-id` or `req.user.tenantId` → `tenantId`
- `req.user.id` → `userId`
- `req.ip` → `ip`

Missing inputs default to a generated UUID for `requestId`/`correlationId`/`traceId`.

## Anti-patterns

- **Don't access `RequestContext` in module constructors or `OnModuleInit`** — there's no active context at boot.
- **Don't mutate the context after creation.** Spawn a new one in a child `runWithContext` if you need to layer fields (e.g. impersonation).
- **Don't propagate the context across processes by serializing the whole object.** Send `correlationId` + `tenantId` + `userId` as message headers; the receiver constructs a fresh `RequestContext`.
