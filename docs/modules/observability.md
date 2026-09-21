# `observability`

```ts
import {
  ObservabilityModule,
  LoggerModule, LoggerService, LoggerInterceptor, redact, LOGGING_PORT,
  TracingModule, TracingService, TracingInterceptor, TRACING_PORT,
  MetricsModule, MetricsService, MetricsController, MetricsInterceptor, METRICS_PORT,
  PrometheusMetricsAdapter, DefaultNoopMetricsAdapter,
  type LogEvent, type LogLevel, type LogContext, type LoggingContract,
  type TracingContract, type TracingSpan,
  type MetricsContract, type CounterMetric, type HistogramMetric,
  type ObservabilityOptions,
} from "@alaska115/nextjs-toolkit/observability";
```

Logging, tracing and metrics behind three ports, each with a no-op default and
a real adapter selected by config.

## One-call setup

```ts
ObservabilityModule.forRoot({
  logging: true,
  tracing: true,
  metrics: true,
  errorTracker: true,
})
```

`forRoot()` is `@Global()` and does all of the following:

- imports `LoggerModule` / `TracingModule` / `MetricsModule` /
  `ErrorTrackingModule` for each enabled flag;
- registers, as `APP_INTERCEPTOR`, in this order:
  `RequestContextInterceptor`, `GlobalResponseInterceptor`, then
  `LoggerInterceptor`, `TracingInterceptor`, `MetricsInterceptor` for the
  enabled subsystems;
- registers `HttpExceptionFilter` as `APP_FILTER`;
- mounts `MetricsController` at `GET /metrics` unless `metrics: false`;
- exports `RequestContextService`, `LoggerService`, `TracingService`,
  `ErrorTrackingService`.

All four options default to `true` and a partial object is **merged over** those
defaults, so `forRoot({ metrics: false })` keeps logging, tracing and error
tracking on. `forRoot()` with no argument enables everything.

You can also import the sub-modules individually and wire the interceptors
yourself, as the [`mini-app` example](../../examples/mini-app/src/app.module.ts)
does.

## Logging

### `LoggerService`

```ts
logger.fatal(msg, meta?); logger.error(msg, meta?); logger.warn(msg, meta?);
logger.info(msg, meta?);  logger.debug(msg, meta?); logger.trace(msg, meta?);
logger.event(logEvent);
```

Every call is enriched from the [request context](./context.md) with
`traceId`, `correlationId`, `requestId`, plus `userId` / `tenantId` when set,
plus a `timestamp`. Anything you pass in `meta` wins over the context value.

`logger.error(msg, meta)` additionally forwards to `ErrorTrackingService` —
but **only when `meta.error` is present**:

```ts
logger.error("charge failed", { error: err, orderId });  // captured
logger.error("charge failed");                            // logged only
```

`event()` takes a full structured `LogEvent` when you want the canonical shape
(`severity`, `message`, `http`, `error`, `serviceName`, `environment`,
`attributes`, …):

```ts
logger.event({
  severity: "info",
  message: "order.created",
  http: { method: "POST", route: "/orders", status: 201, latencyMs: 42 },
  attributes: { orderId, amountCents },
});
```

With no adapter bound, `LoggerService` falls back to
`console.log(JSON.stringify(...))` — it never throws for lack of wiring.

### Adapter selection

`LoggerModule` binds `LOGGING_PORT` from `observability.loggingProvider`
(`OBSERVABILITY_LOGGING`):

| Value               | Adapter                        | Requires |
| ------------------- | ------------------------------ | -------- |
| `winston` (default) | `WinstonLoggingAdapter`        | `winston` — a direct dependency, always present |
| anything else       | `DefaultConsoleLoggingAdapter` | —        |

The Winston adapter reads `logging.level`, `logging.dir`, `logging.file` and
`logging.displayConsole`, and flushes on shutdown via
[`ShutdownManager`](./shutdown.md).

### `LoggerInterceptor`

Emits two `info` records per request — `http_request_start` and
`http_request_end` (with `statusCode` and `durationMs`) — and one `error`
record (`http_request_error`, including the stack) when the handler throws.

### `redact`

```ts
redact(value, { extraKeys?: string[], exceptKeys?: string[], maxDepth?: number })
```

Deep-copies `value`, replacing any matching key's value with `"[REDACTED]"`
(default depth 6). The built-in deny-list covers auth headers (`authorization`,
`cookie`, `x-api-key`, …), credential fields (`password`, `secret`, `token`,
`refresh_token`, `private_key`, …) and common PII (`ssn`, `credit_card`, `cvv`,
`iban`, …). [`HttpExceptionFilter`](./errors.md) runs request headers through it
automatically.

## Tracing

### `TracingService`

```ts
const span = tracing.startSpan("charge.card", { provider: "stripe" });
try { /* ... */ } finally { span.end(); }

// or, scoped — ends the span and records the exception for you:
await tracing.runInSpan("charge.card", async (span) => {
  span.setAttribute("amount_cents", 1200);
  span.addEvent?.("authorized");
  return charge();
});
```

`TracingSpan`: `end(error?)`, `setAttribute`, `setAttributes`,
`recordException`, optional `addEvent`.

### Adapter selection

`TRACING_PORT` comes from `observability.tracingProvider`
(`OBSERVABILITY_TRACING`):

| Value            | Adapter                     | Requires |
| ---------------- | --------------------------- | -------- |
| `otel` (default) | `OtelTracingAdapter`        | the optional `@opentelemetry/*` peer deps (SDK Node, OTLP HTTP exporter, HTTP + Express instrumentation, resources, semantic conventions) |
| `noop`           | `DefaultNoopTracingAdapter` | —        |

The OTel adapter starts the Node SDK on module init, shuts it down on destroy,
and registers a flush hook with `ShutdownManager`. The no-op adapter still
generates trace and span ids, so correlation keeps working with tracing off.

## Metrics

### `MetricsService`

```ts
metrics.counter("orders_created_total").inc({ status: "ok" });
metrics.histogram("db_query_ms").observe({ table: "orders" }, 12);

metrics.httpRequestCounter();   // counter "http_requests_total"
metrics.httpRequestDuration();  // histogram "http_request_duration_ms"
await metrics.export();         // exposition text from the adapter
```

With no adapter bound, `counter()` and `histogram()` return no-op objects and
`export()` returns `"# metrics export not implemented\n"`.

### Label constraints with the Prometheus adapter

`PrometheusMetricsAdapter` creates every counter and histogram with a **fixed**
label set:

```
method, route, status, correlationId, traceId, service, env
```

Two consequences:

1. Passing a label outside that list (`{ tenant: "acme" }`) makes `prom-client`
   throw. Stick to the seven, or bind your own `MetricsContract` adapter.
2. `metrics.withContextLabels(labels)` merges in `traceId` and `correlationId`,
   which are unique per request. Feeding those to Prometheus creates one time
   series per request. Don't use it for Prometheus — pass low-cardinality labels
   (`route` template, `status`) to `inc()` / `observe()` directly.

The adapter keeps its own `Registry` (with `collectDefaultMetrics` and default
labels `service` / `env` from `SERVICE_NAME` and `NODE_ENV`), so metrics that
other code registers on `prom-client`'s **default** registry do not appear at
`/metrics`. [`NotificationService`](./messaging.md) is one such caller.

### Adapter selection

`METRICS_PORT` comes from `observability.metricsProvider`
(`OBSERVABILITY_METRICS`):

| Value                  | Adapter                     | Requires |
| ---------------------- | --------------------------- | -------- |
| `prometheus` (default) | `PrometheusMetricsAdapter`  | `prom-client` (optional peer dep) |
| `noop`                 | `DefaultNoopMetricsAdapter` | —        |

### `MetricsController`

`GET /metrics`, returning `MetricsService.export()`. Mounted by
`ObservabilityModule.forRoot()` unless `metrics: false`. It sits behind your
global prefix — with the defaults that is `GET /api/metrics`. Keep it off the
public internet or put a guard in front of it.

## Error tracking

`ObservabilityModule.forRoot({ errorTracker: true })` imports
`ErrorTrackingModule` and binds `ErrorTrackingService`, which
`LoggerService` and `HttpExceptionFilter` use internally. The Sentry adapter
(`SentryErrorTrackingAdapter`) requires the optional `@sentry/node` peer dep
plus your own `Sentry.init()` at boot. With no adapter bound,
`captureError(error, context?)` is a no-op.

> **Known gap (as of 0.7.0):** `ErrorTrackingService`, `ErrorTrackingModule`,
> `ERROR_TRACKING_PORT` and `ErrorTrackingContract` are **not re-exported** from
> the `/observability` entrypoint or the package root, so you cannot import them
> by name to bind a custom tracker. Until that is fixed, route errors through
> `logger.error(message, { error })`, which forwards to whatever tracker the
> module bound.

## Writing your own adapter

Each port is a one- or two-method interface — `LoggingContract`,
`TracingContract`, `MetricsContract` — bound to a `Symbol` token. Implement the
interface, bind it to the symbol, done. See
[ADR 0001](../adr/0001-port-adapter-everywhere.md) and
[ADR 0002](../adr/0002-symbol-di-tokens.md).
