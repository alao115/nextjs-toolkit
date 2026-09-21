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

## Prisma isn't logging my queries

Query logging is opt-in: set `logQueries: true` on the persistence config. It
defaults to off because SQL text routinely carries personal data and credentials
in literals.

## `/metrics` doesn't show my notification metrics

`NotificationService` registers its counters on `prom-client`'s **default**
registry, while `PrometheusMetricsAdapter` exports its own. Scrape
`client.register.metrics()` separately, or re-register those metrics yourself.

## Health endpoints return 503 and my probes now fail

They are working. Since 0.8.0 the controller maps the check outcome to the HTTP
status: `200` for `"ok"`, `503` for anything else. Before that it always
returned 200, so a probe keyed on the status code never fired.

If a probe started failing after upgrading, an indicator really is down — read
`details` in the response body to see which. `/health/live` has no external
dependencies and stays 200 as long as the process is alive; point
`livenessProbe` there and `readinessProbe` at `/health/ready`.

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

## `No notification provider registered for channel: sms`

Expected: `NotificationModule` registers only the email provider. Up to 0.7.0 it
wired SMS and WhatsApp to clients that just `console.log`'d, so sends resolved
`success: true` and delivered nothing; the throw replaced that silent drop.

Override `NOTIFICATION_PROVIDERS` with your own array — `SmsProvider` and
`WhatsAppProvider` still ship, so you only need to supply an `SmsClient` /
`WhatsAppClient`. (The `SMS_PROVIDER` / `WHATSAPP_PROVIDER` symbols are exported
but unbound; overriding those does nothing.)

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

The subpath export was removed in **0.7.0**, and the source was deleted from the
repository in **0.8.0**. Pin `0.6.x` if you depend on it, or lift the module
into your service — `git show v0.7.0:file-storage` has the last copy.

## Still stuck

Run the smoke test against a fresh install to confirm the published package
works at all:

```bash
cd examples/mini-app && pnpm install && pnpm run smoke
```

Then open an issue at
<https://github.com/alao115/nextjs-toolkit/issues> with the failing snippet and
your `tsconfig.json`.
