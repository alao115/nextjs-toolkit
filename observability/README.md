# `@alaska115/nextjs-toolkit/observability`

The three pillars (logs, metrics, traces) plus error tracking, each behind a port. Default adapters are console / noop; opt into real backends (Winston, OpenTelemetry, Prometheus, Sentry) via config — heavy SDKs are lazy-required so unused adapters cost nothing.

## Wire it up

```ts
import {
  ObservabilityModule,
  LoggerModule,
  TracingModule,
  MetricsModule,
} from "@alaska115/nextjs-toolkit/observability";

@Module({
  imports: [
    LoggerModule,
    TracingModule,
    MetricsModule,
    ObservabilityModule.forRoot({
      logging: true,
      tracing: true,
      metrics: true,
      errorTracker: true,
    }),
  ],
})
export class AppModule {}
```

`ObservabilityModule.forRoot()` registers three global interceptors: `RequestContextInterceptor` (must be first), `GlobalResponseInterceptor`, and per-pillar `LoggerInterceptor` / `TracingInterceptor` / `MetricsInterceptor`. Also registers the `HttpExceptionFilter`.

## Configure adapters

```env
OBSERVABILITY_LOGGING=winston      # or "console" (default)
OBSERVABILITY_TRACING=otel         # or "noop" (default)
OBSERVABILITY_METRICS=prometheus   # or "noop" (default)
LOG_LEVEL=info
SERVICE_NAME=my-service
SERVICE_VERSION=1.2.3
OTLP_ENDPOINT=http://collector:4318/v1/traces
```

When `OBSERVABILITY_TRACING=otel`, the OpenTelemetry SDK is lazy-required and configured with HTTP + Express instrumentation. The shutdown hook flushes pending spans on SIGTERM.

## Log structured

```ts
constructor(private readonly logger: LoggerService) {}

// Loose form — anything you want in the meta bag
this.logger.info("user.created", { userId, tenantId, source: "signup" });

// Structured (canonical LogEvent shape, recommended for new code)
this.logger.event({
  severity: "info",
  message: "user.created",
  http: { method: "POST", route: "/users", status: 201 },
  userId,
  tenantId,
  attributes: { source: "signup" },
});
```

Both forms auto-enrich with `requestId`, `correlationId`, `traceId`, `userId`, `tenantId` from the active `RequestContext`.

## Trace

```ts
constructor(private readonly tracing: TracingService) {}

async handleOrder(orderId: string) {
  return this.tracing.runInSpan("handleOrder", async (span) => {
    span.setAttribute("order.id", orderId);
    span.addEvent?.("validation.start");
    await this.validate(orderId);
    span.addEvent?.("validation.done");
    return this.persist(orderId);
  });
}
```

## Metrics

```ts
constructor(private readonly metrics: MetricsService) {}

const counter = this.metrics.getCounter("orders_created_total");
counter.inc({ tenant: tenantId, status: "ok" });
```

Counter / histogram label cardinality matters — avoid high-cardinality labels like `userId` (one time series per user is a Prometheus killer).

## Anti-patterns

- **Don't `console.log` in business code.** Use `LoggerService`. Every adapter respects level filtering; `console.log` doesn't.
- **Don't put secrets in span attributes.** Spans get exported to OTel collectors; assume everything is captured forever.
- **Don't `logger.error()` for expected branches** (validation failures, 404s). Use `warn` or `info`. The `error` path forwards to error tracking, which pages on-call.
- **Don't create a new counter inside a hot path.** `prom-client` interns by name; reuse the same instance.
