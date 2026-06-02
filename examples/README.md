# Examples

Copy-paste-ready snippets that show how to wire each module of `@alaska115/nextjs-toolkit` in a NestJS application. They're not runnable apps — they're the minimum integration code, well-commented, so you can lift them into your own service.

| # | File | What it covers |
|---|---|---|
| 01 | [`01-app-bootstrap.ts`](./01-app-bootstrap.ts) | Minimal `AppModule` wiring: ConfigurationModule (Joi validated), ShutdownModule, Observability, Logger, Tracing, Metrics, Persistence, Cache, Health |
| 02 | [`02-audit.ts`](./02-audit.ts) | Emitting audit events with auto-resolved actors + tamper-evident chain verification |
| 03 | [`03-outbox-worker.ts`](./03-outbox-worker.ts) | Transactional outbox writes + the worker loop with Kafka publishing + DLQ |
| 04 | [`04-rate-limit.ts`](./04-rate-limit.ts) | Global rate-limit guard + per-endpoint cost overrides + Redis adapter |
| 05 | [`05-feature-flags.ts`](./05-feature-flags.ts) | Static dev config, OpenFeature-backed prod, deterministic % rollout |
| 06 | [`06-resilience.ts`](./06-resilience.ts) | Timeout + retry-with-Retry-After + bulkhead + distributed circuit breaker + deadline propagation |
| 07 | [`07-multi-tenancy.ts`](./07-multi-tenancy.ts) | Tenant resolution from header, tenant-scoped queries + cache keys + rate-limit composition |
| 08 | [`08-secrets-vault.ts`](./08-secrets-vault.ts) | Vault-backed secret manager, canary check at boot, rotation listener to invalidate caches |
| 09 | [`09-error-handling.ts`](./09-error-handling.ts) | Domain exceptions via `BaseException`, status→code mapping, PII redaction, `catchError` vs throw |
| 10 | [`10-observability-tracing.ts`](./10-observability-tracing.ts) | `LogEvent` structured logging, spans with attributes + events, label-cardinality anti-patterns |
| 11 | [`11-graceful-shutdown.ts`](./11-graceful-shutdown.ts) | Phased hooks, readiness coordination, the right SIGTERM handling order for Kubernetes |

These compile against `@alaska115/nextjs-toolkit` v0.7+. If a snippet drifts, file an issue.

## Conventions

- **Imports use the published subpath** (`@alaska115/nextjs-toolkit/audit`, etc.) so you can copy without rewriting paths.
- **Adapter wiring assumes optional peer deps are installed.** If you don't use Prisma, you don't need `@prisma/client`; the example for outbox just doesn't apply to you.
- **Heavy SDKs (Prisma, ioredis, OpenFeature) are imported normally in examples** — they're devDependencies of the example, not of the package.
