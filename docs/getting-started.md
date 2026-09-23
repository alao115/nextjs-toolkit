# Getting started

From an empty NestJS service to one running with config validation, structured
logging, request correlation, canonical error responses, health probes and
graceful shutdown. Should take about ten minutes.

## 1. Install

```bash
pnpm add @alaska115/nextjs-toolkit
```

Then the peer dependencies you actually need. The always-required set:

```bash
pnpm add @nestjs/common@^12 @nestjs/core@^12 @nestjs/platform-express@^12 \
         @nestjs/config@^12 @nestjs/cache-manager@^12 @nestjs/swagger@^12 \
         cache-manager@^7 keyv@^5 \
         express@^4 rxjs@^7 reflect-metadata \
         class-validator@^0.14 class-transformer@^0.5
```

`cache-manager` and `keyv` are peers of `@nestjs/cache-manager`; the toolkit's
[`cache`](./modules/cache.md) subpath (and the package root, which re-exports
it) needs them at runtime.

Everything else is an **optional** peer dependency — install only what the
modules you use require:

| You use…                                | Install |
| --------------------------------------- | ------- |
| [`persistence`](./modules/persistence.md) with Prisma | `@prisma/client` `@prisma/adapter-pg` |
| [`observability`](./modules/observability.md) metrics | `prom-client` |
| [`observability`](./modules/observability.md) tracing | `@opentelemetry/api` `@opentelemetry/sdk-node` `@opentelemetry/exporter-trace-otlp-http` `@opentelemetry/instrumentation` `@opentelemetry/instrumentation-http` `@opentelemetry/instrumentation-express` `@opentelemetry/resources` `@opentelemetry/semantic-conventions` |
| Sentry error tracking                   | `@sentry/node` |
| [`messaging`](./modules/messaging.md)   | `nodemailer` (default mail transport), `twig` (only for `mail.templateEngine=twig`) |
| [`security`](./modules/security.md) password hashing | `argon2` |
| [`bootstrap`](./modules/bootstrap.md) ngrok tunnel | `@ngrok/ngrok` |

## 2. Configure TypeScript

The package ships subpath exports (`@alaska115/nextjs-toolkit/errors`, …), which
the legacy resolver cannot read:

```json
{
  "compilerOptions": {
    "moduleResolution": "node16",   // or "nodenext" or "bundler"
    "module": "node16",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2021"
  }
}
```

Set `"type": "module"` in your `package.json` too. NestJS 12 is ESM-only, and
TypeScript refuses to emit a `require` for it from a CommonJS file
(`TS1479`). Relative imports then need explicit `.js` extensions.

Compile with **tsc**, not esbuild-based runners like `tsx`: esbuild cannot emit
`design:paramtypes`, and without it every Nest constructor injection resolves
to `undefined`.

With `"moduleResolution": "node"` every subpath import fails with
`Cannot find module '@alaska115/nextjs-toolkit/<subpath>'`. See
[troubleshooting](./troubleshooting.md).

## 3. Environment

```dotenv
# .env
NODE_ENV=development
APP_NAME=orders-api
HTTP_PORT=3001
HTTP_GLOBAL_PREFIX=api

OBSERVABILITY_LOGGING=console
OBSERVABILITY_TRACING=noop
OBSERVABILITY_METRICS=noop
LOG_LEVEL=debug
```

Start with the `noop` / `console` providers so nothing needs OTel collectors or
`prom-client` on day one. Flip them on once the service is running. Every
variable is listed in the [configuration reference](./configuration.md).

## 4. `app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";
import { LoggerModule } from "@alaska115/nextjs-toolkit/observability";
import {
  RequestContextInterceptor,
  GlobalResponseInterceptor,
} from "@alaska115/nextjs-toolkit/context";
import { HttpExceptionFilter } from "@alaska115/nextjs-toolkit/errors";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";

import { OrdersController } from "./orders.controller";

@Module({
  imports: [
    ConfigurationModule,   // first — validates env, makes ConfigService global
    ShutdownModule,        // global ShutdownManager other modules hook into
    LoggerModule,          // brings ContextModule (RequestContextService) with it
    HealthModule.forRoot({ enableDb: false, enableNotifications: false }),
  ],
  controllers: [OrdersController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

Three rules that will save you an afternoon:

1. `ConfigurationModule` goes first.
2. **Never re-provide `RequestContextService`.** It arrives globally via
   `ContextModule`, which `LoggerModule` / `TracingModule` / `MetricsModule`
   import. A second instance means a second `AsyncLocalStorage`, and your
   correlation ids vanish.
3. `RequestContextInterceptor` must be the first interceptor — everything
   registered before it runs outside the request scope.

Once you want the full stack, replace the three manual `providers` entries with
[`ObservabilityModule.forRoot()`](./modules/observability.md), which registers
all of them plus the tracing and metrics interceptors.

## 5. `main.ts`

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import {
  registerDefaults,
  corsRegistration,
  helmetRegistration,
  registerShutdownAppHook,
} from "@alaska115/nextjs-toolkit/bootstrap";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  registerDefaults(app, config);   // prefix, versioning, body limits, ValidationPipe
  corsRegistration(app, config);
  helmetRegistration(app);
  registerShutdownAppHook(app);    // closes the HTTP server on SIGTERM

  await app.listen(config.get<number>("http.port") ?? 3001);
}
bootstrap();
```

## 6. Write a controller

```ts
import { Controller, Get, Param } from "@nestjs/common";
import { LoggerService } from "@alaska115/nextjs-toolkit/observability";
import { BaseException } from "@alaska115/nextjs-toolkit/errors";

class OrderNotFoundError extends BaseException {
  constructor(id: string) {
    super(`Order '${id}' not found`, "ORDER_NOT_FOUND", 404, { id });
  }
}

@Controller("orders")
export class OrdersController {
  constructor(private readonly logger: LoggerService) {}

  @Get(":id")
  async findOne(@Param("id") id: string) {
    this.logger.info("fetching order", { orderId: id });   // auto-correlated
    const order = await this.repo.find(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }
}
```

## 7. See it work

```bash
pnpm start:dev
curl -i http://localhost:3001/api/v1/orders/abc
curl    http://localhost:3001/api/health/live
```

A success is wrapped by `GlobalResponseInterceptor`:

```json
{ "success": true, "timestamp": "…", "correlationId": "…", "data": { } }
```

A failure is shaped by `HttpExceptionFilter`:

```json
{ "status": 404, "code": "ORDER_NOT_FOUND", "message": "Order 'abc' not found",
  "details": { "id": "abc" }, "correlationId": "…" }
```

Note that `registerDefaults` enables URI versioning, so routes live under
`/api/v1/...` unless you set `@Version()` or drop that call.

Every log line for that request carries the same `correlationId`. Pass
`-H "x-correlation-id: my-trace"` to supply your own.

## Where to go next

| Want to…                                   | Read |
| ------------------------------------------ | ---- |
| Wire a real database                       | [`persistence`](./modules/persistence.md) |
| Add Prometheus + OTel                      | [`observability`](./modules/observability.md) |
| Rate-limit endpoints                       | [`rate-limit`](./modules/rate-limit.md) |
| Publish events reliably                    | [`outbox`](./modules/outbox.md) |
| Scope everything per tenant                | [`multi-tenancy`](./modules/multi-tenancy.md) |
| Run a complete working app                 | [`examples/mini-app`](../examples/mini-app/) |
| Copy a single integration snippet          | [`examples/`](../examples/) |
