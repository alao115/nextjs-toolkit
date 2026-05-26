# mini-app

A runnable NestJS application that installs `@alaska115/nextjs-toolkit` **from npm** and exercises six modules end-to-end. Use it to verify the published package works in a fresh consumer, or as a starting point for your own service.

## Run

```bash
cd examples/mini-app
pnpm install                  # pulls @alaska115/nextjs-toolkit@^0.4.1 from npm
cp .env.example .env          # tweak HTTP_PORT etc. if you want
pnpm start:dev                # boots on http://localhost:3001
```

## Endpoints

| Method | Path                       | What it demonstrates |
| ------ | -------------------------- | -------------------- |
| GET    | `/api/hello`               | `LoggerService` auto-enrichment with `requestId` / `correlationId`. Wrapped in `AppResponse` envelope by `GlobalResponseInterceptor`. |
| GET    | `/api/tenant`              | `TenantService.current() / cacheKey() / scopedWhere()`. Send `-H "x-tenant-id: acme"` to see scoping. |
| GET    | `/api/flag/:name`          | `FeatureFlagsService.isEnabled() / inRollout()`. Try `new-checkout` (on) and `experimental-search` (off). |
| GET    | `/api/error`               | Throws a `BaseException` subclass. `HttpExceptionFilter` shapes the response: 404 with `code: "WIDGET_NOT_FOUND"`, `details`, `correlationId`. |
| GET    | `/api/slow`                | `retry()` + `withTimeout()` from the resilience module — first two attempts fail transiently, third succeeds. |
| GET    | `/api/health/live`         | Cheap health check, mounted by `HealthModule.forRoot({ orm: "inmemory" })`. |
| GET    | `/api/health/ready`        | Full readiness check including the inmemory ORM indicator. |
| GET    | `/api/health`              | Same as `/ready` (convenience alias). |

## Try it

```bash
curl http://localhost:3001/api/hello
curl -H "x-tenant-id: acme" http://localhost:3001/api/tenant
curl http://localhost:3001/api/flag/new-checkout
curl -i http://localhost:3001/api/error            # 404 with canonical body
curl http://localhost:3001/api/slow                # ~150ms, succeeds after retries
curl http://localhost:3001/api/health/live
```

## Automated smoke test

```bash
pnpm run smoke
```

Boots the app on port 13571, hits every endpoint, asserts the expected shape and status, then shuts down. Exit code is 0 iff every check passes. **This is the canonical "the published package still works" test** — run it after every publish.

## What's deliberately NOT in here

- **No real database** — the app uses `orm: "inmemory"` so health checks pass without a Postgres / Prisma setup. To wire Prisma, change `app.module.ts` and add `@prisma/client` + `@prisma/adapter-pg` to `dependencies`.
- **No real Redis** — `CacheStoreModule` isn't wired here. Add it the same way as in [`examples/01-app-bootstrap.ts`](../01-app-bootstrap.ts).
- **No real audit / outbox / messaging backend** — those need Postgres / Kafka / SMTP. The reference snippets in [`examples/02-*` through `12-*`](..) show how to wire them with real adapters.

## Layout

```
mini-app/
├── package.json          # depends on @alaska115/nextjs-toolkit@^0.4.1 from npm
├── tsconfig.json
├── .env.example
├── src/
│   ├── main.ts           # NestFactory bootstrap, cors/helmet wiring
│   ├── app.module.ts     # composes 8 toolkit modules
│   ├── widget.controller.ts   # demo endpoints
│   └── widget.exception.ts    # BaseException subclass
└── scripts/
    └── smoke.ts          # end-to-end assertion runner
```
