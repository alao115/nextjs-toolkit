# ADR 0004 — Request scope lives in `AsyncLocalStorage`, not in argument lists

**Status:** Accepted &nbsp;·&nbsp; **Date:** 2026-05 &nbsp;·&nbsp; **Stability:** Stable

## Context

Cross-cutting fields — `requestId`, `correlationId`, `traceId`, `userId`, `tenantId`, `ip` — need to be available in every layer (controllers, services, repos, adapters, observability ports). Threading them through every signature is invasive and a recurring source of bugs (forgetting to pass them deep enough means logs don't correlate).

OpenTelemetry has its own context propagation, but it covers only trace/span IDs, not domain identity (`userId`, `tenantId`).

## Decision

The package owns a `RequestContext` populated by `RequestContextInterceptor` at the controller boundary and stored in Node's `AsyncLocalStorage`. Any code path reachable from that controller can read it via `RequestContextService.getContext()` without ceremony.

Downstream primitives consume it transparently:

- `LoggerService` auto-enriches every emitted log with `traceId`, `correlationId`, `requestId`, `userId`, `tenantId`.
- `AuditLogService` reads `tenantId` + `correlation` from it.
- `FeatureFlagsService.inRollout()` defaults the bucketing subject to `userId ?? tenantId`.
- `TenantService.scopedWhere()` throws if `tenantId` isn't set under `strict: true`.
- `RateLimitGuard` composes its default key from `tenantId:userId:route`.
- `withDeadline()` (in `resilience`) propagates the deadline through the same ALS storage.

## Consequences

- **No signature pollution.** A service method takes its arguments, not its caller's identity.
- **Background jobs / queue workers** must explicitly set up a context (`ctxService.runWithContext(...)`) before invoking domain code, or the implicit reads will return `undefined`. This is documented per module.
- **The store is process-local.** Cross-service propagation (e.g. via Kafka) still requires explicit serialization of the relevant fields on the producer side.
- **Tests** that exercise context-aware code must wrap calls in `RequestContextService.runWithContext(new RequestContext({...}), () => fn())`. That's a tiny ergonomic cost for the win of not threading identity through every layer.
