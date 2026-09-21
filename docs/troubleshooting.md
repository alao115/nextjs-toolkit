# Troubleshooting

## `Cannot find module '@alaska115/nextjs-toolkit/<subpath>'`

Your `moduleResolution` is the legacy `node` / `node10` resolver, which does not
read `package.json` `exports`.

```json
{ "compilerOptions": { "module": "node16", "moduleResolution": "node16" } }
```

`nodenext` and `bundler` work too. See
[`examples/mini-app/tsconfig.json`](../examples/mini-app/tsconfig.json).

The root import (`@alaska115/nextjs-toolkit`) works under any resolver, so a
codebase stuck on the old one can fall back to it — but note the root re-exports
only `cache`, `context`, `errors`, `health`, `messaging`, `observability`,
`persistence`, `shutdown` and `utils`.

## `Cannot find module '@prisma/adapter-pg'` (or `prom-client`, `argon2`, `@opentelemetry/*`, `twig`, `nodemailer`, `minio`, `@sentry/node`, `@ngrok/ngrok`)

These are **optional** peer dependencies. Install the ones the modules you use
need — see the table in [getting started](./getting-started.md#1-install).

`@prisma/adapter-pg` in particular is required by `PrismaService` unless you
pass your own `driverFactory`.

## Logs have no `correlationId` / `requestId`

One of three things:

1. `RequestContextInterceptor` isn't registered, or isn't first. Register it via
   `APP_INTERCEPTOR` ahead of every other interceptor, or use
   `ObservabilityModule.forRoot()`.
2. **You re-provided `RequestContextService`.** It comes from the global
   `ContextModule` (imported transitively by `LoggerModule` / `TracingModule` /
   `MetricsModule`). Listing it again in your own `providers` creates a second
   `AsyncLocalStorage`, and the interceptor writes to the one your services
   don't read.
3. You're outside a request — a cron job, queue consumer, or boot code.
   `getContext()` returns `undefined` there by design; open a scope yourself
   with `runWithContext` if you want correlation in background work.

## Everything is disabled after `ObservabilityModule.forRoot({ metrics: false })`

The options object **replaces** the defaults instead of merging. Pass every flag:

```ts
ObservabilityModule.forRoot({ logging: true, tracing: true, metrics: false, errorTracker: true })
```

## `registerSwagger({ enabled: true })` throws about missing config keys

`swagger.title` and `swagger.version` are not produced by the package's config
factory. Add a `swagger` namespace through your own
`ConfigModule.forRoot({ load: [...] })` — see
[configuration](./configuration.md#keys-you-must-supply-yourself).

## `SetupNgrokProxyModule.setup` throws about `http.port` / `ngrok.token`

Same shape of problem, different keys. Since 0.5.0 there is no implicit
"skip in production" — set `enabled: false` when you don't want a tunnel.

## `CORS_ENABLED=false` doesn't disable CORS

It can't: `cors.enabled` is computed as
`process.env.CORS_ENABLED === "true" || true`, which is always `true`. Don't
call `corsRegistration(app, config)` when you don't want CORS.

## Prometheus throws `Added label "x" is not included in initial labelset`

`PrometheusMetricsAdapter` creates every metric with a fixed label set:
`method`, `route`, `status`, `correlationId`, `traceId`, `service`, `env`.
Use only those, or bind your own `MetricsContract` adapter.

Relatedly: `metrics.withContextLabels()` injects `traceId` and `correlationId`,
which are unique per request. Don't feed them to Prometheus.

## `/metrics` doesn't show my notification metrics

`NotificationService` registers its counters on `prom-client`'s **default**
registry, while `PrometheusMetricsAdapter` exports its own. Scrape
`client.register.metrics()` separately, or re-register those metrics yourself.

## Kubernetes never restarts / never drains my pod

`HealthHttpController` always returns HTTP **200** — the failure is in the JSON
body (`status: "degraded"` / `"down"`). Probes that key on the status code will
never fire. Configure the probe against the body, or wrap the endpoints in a
controller of your own that maps `status` to 200/503.

## `TenantNotSetError` in a background job

`TenantService` reads the tenant from the request context, which doesn't exist
outside a request. Open one explicitly:

```ts
await ctxService.runWithContext(
  new RequestContext({ tenantId, requestId: jobId, correlationId: jobId, traceId: jobId, secured: false }),
  () => this.processJob(job),
);
```

Or pass `{ strict: false }` to `scopedWhere` where a cross-tenant read is
genuinely intended.

## Requests 400 with `property … should not exist`

`registerDefaults` installs a `ValidationPipe` with `forbidNonWhitelisted: true`.
Declare the property on your DTO, or skip `registerDefaults` and wire your own
pipe.

## Rate limiting is twice as permissive as configured

You're running more than one instance with an in-memory adapter — each has its
own buckets. Use `RedisRateLimitAdapter`.

## Outbox records pile up and never publish

`OutboxWorker.onModuleInit()` only registers the shutdown hook; it does **not**
start the loop. Call `worker.configure({...}).start()`.

If records are accumulating `attempts` instead, their `type` has no matching
subscriber — add one, or a `"*"` catch-all.

## SMS / WhatsApp notifications "succeed" but nothing arrives

`NotificationModule` wires dummy SMS and WhatsApp clients that only
`console.log`. Override `NOTIFICATION_PROVIDERS` with real providers. (The
`SMS_PROVIDER` / `WHATSAPP_PROVIDER` symbols are exported but unbound — 
overriding them does nothing.)

## `KMS_PROVIDER=vault` but secrets are empty

If `VAULT_ADDR` or `VAULT_TOKEN` is missing, `SecretsModule` logs a warning and
falls back to `LocalSecretManager`, which holds nothing. Run `canaryCheck` at
boot so this fails loudly instead of at first use.

## `import { bootstrap } from ".../bootstrap"` doesn't exist

There is no `bootstrap()` function — the module exports individual registration
helpers (`registerDefaults`, `corsRegistration`, `helmetRegistration`, …). See
[`bootstrap`](./modules/bootstrap.md).

## `AppResponse` / `BaseCrudController` won't import

They exist under `utils/resource/` but aren't re-exported from `/utils`. Declare
the envelope shape yourself — see [`utils`](./modules/utils.md#not-exported).

## `@alaska115/nextjs-toolkit/file-storage` is gone

The subpath export was removed in **0.7.0**. The source still lives in the repo
but is excluded from the build. Pin `0.6.x` if you depend on it, or copy the
module into your service.

## Still stuck

Run the smoke test against a fresh install to confirm the published package
works at all:

```bash
cd examples/mini-app && pnpm install && pnpm run smoke
```

Then open an issue at
<https://github.com/alao115/nextjs-toolkit/issues> with the failing snippet and
your `tsconfig.json`.
