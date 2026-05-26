# ADR 0001 — Port/Adapter pattern for every external boundary

**Status:** Accepted &nbsp;·&nbsp; **Date:** 2026-05 &nbsp;·&nbsp; **Stability:** Stable

## Context

Internal services historically pulled MinIO, Prisma, Sentry, OpenTelemetry, Winston, Prometheus, Vault, Bomboo, etc. directly into business code. That coupled the domain to specific infrastructure choices, broke testability, and made it impossible to publish the toolkit as a standalone package because every consumer inherited every dependency.

## Decision

Every external boundary in the package is split into a **Port** (a TypeScript interface) and one or more **Adapters** (concrete implementations selected at module composition time). The list:

| Concern        | Port symbol                | Default adapter             |
| -------------- | -------------------------- | --------------------------- |
| Logging        | `LOGGING_PORT`             | `DefaultConsoleLoggingAdapter` |
| Metrics        | `METRICS_PORT`             | `DefaultNoopMetricsAdapter` |
| Tracing        | `TRACING_PORT`             | `DefaultNoopTracingAdapter` |
| Error tracking | `ERROR_TRACKING_PORT`      | (none, optional)            |
| Persistence    | `PERSISTENCE_ADAPTER`      | `InMemoryPersistenceAdapter` |
| File storage   | `STORAGE_ADAPTERS`         | `noopStorageAdapter`        |
| Secrets        | `SECRET_MANAGER`           | `LocalSecretManager`        |
| Audit log      | `AUDIT_LOG_PORT`           | `DefaultAuditLogAdapter`    |
| Feature flags  | `FEATURE_FLAGS_PORT`       | `StaticFeatureFlagsAdapter` |
| Rate limit    | `RATE_LIMIT_PORT`          | `InMemoryRateLimitAdapter`  |
| Outbox         | `OUTBOX_PORT`              | `InMemoryOutboxAdapter`     |

## Consequences

- **Heavy SDKs (`@opentelemetry/*`, `@prisma/client`, `argon2`, `minio`, `nodemailer`, `twig`, `@sentry/node`, `prom-client`, `@ngrok/ngrok`) are optional peer dependencies.** Adapters lazy-`require()` them inside their factory so a consumer who only uses `@alaska115/nextjs-toolkit/utils` doesn't pay the install cost.
- **Tests can swap any port for an in-memory fake** without touching domain code.
- **Adding a new backend is local.** New Redis adapter? Drop it next to the existing in-memory one; bind the port via `forRoot()`.
- **The trade-off**: every consumer has to wire the adapter once at app start. We accept the boilerplate in exchange for testability and tree-shakability.
