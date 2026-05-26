# Changelog

All notable changes to `@alaska115/nextjs-toolkit` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0]

**Renamed: `@mdc/package-core` → `@alaska115/nextjs-toolkit`.**

### Changed

- **BREAKING CHANGE: package name.** Every consumer must update their
  imports from `@mdc/package-core` to `@alaska115/nextjs-toolkit`. A single
  find-and-replace across the codebase is sufficient — module surface,
  exports, and behavior are otherwise unchanged.

  ```diff
  - import { LoggerService } from "@mdc/package-core/observability";
  + import { LoggerService } from "@alaska115/nextjs-toolkit/observability";
  ```

  And in `package.json`:

  ```diff
  - "@mdc/package-core": "workspace:*"
  + "@alaska115/nextjs-toolkit": "workspace:*"
  ```

  Then run `pnpm install` to refresh the lockfile.

- README updated to reflect the new scope. `npm pack` now produces
  `alaska115-nextjs-toolkit-<version>.tgz`.

### Note

The package contents — 20 subpath modules, all adapters, all primitives —
are byte-identical to `0.3.1`. This is a pure rename release intended as a
stable identity for publishing.

## [0.3.1]

Documentation pass: per-module READMEs + 4 more integration examples.

### Added

- **Per-module READMEs** for the remaining 14 modules: `bootstrap`, `cache`,
  `config`, `context`, `errors`, `file-storage`, `health`, `messaging`,
  `observability`, `persistence`, `secret`, `security`, `shutdown`, `utils`.
  Each follows the same shape: one-paragraph intro, "Wire it up", brief
  usage examples, anti-patterns. The package now ships **20 module READMEs**
  (one per subpath).
- **`examples/09-error-handling.ts`** — `BaseException` subclasses, the
  status→code mapping table the filter applies, PII redaction proof,
  `catchError` vs throw decision rule.
- **`examples/10-observability-tracing.ts`** — `LogEvent` canonical shape
  vs. loose meta-bag, spans with attributes + `addEvent`, metric-label
  cardinality anti-patterns.
- **`examples/11-graceful-shutdown.ts`** — phased hook registration,
  readiness coordination, the canonical SIGTERM handling order for
  Kubernetes, the "wrap slow drains in `withTimeout()`" pattern.
- **`examples/12-file-storage.ts`** — generic primitives, building
  domain-specific flows (`SignupAttachmentService` wraps `uploadToBucket`
  with tenant-scoped paths), the "promote from staging" pattern.

## [0.3.0]

Persistent adapters for every `@experimental` primitive + `examples/` directory.

### Added

- **`PrismaAuditLogAdapter`** ([audit/prisma-audit-log.adapter.ts](audit/prisma-audit-log.adapter.ts)) —
  append-only audit log backed by a Prisma table, with tamper-evident
  SHA-256 hash chain (`previousHash` → `hash` linkage, sequence-locked
  inside a transaction so concurrent emits can't both link to the same
  parent). Model schema documented inline.
- **`OpenFeatureFlagsAdapter`** ([feature-flags/openfeature.adapter.ts](feature-flags/openfeature.adapter.ts)) —
  duck-typed wrapper for OpenFeature `Client`-shaped clients. Works with
  any OpenFeature provider (LaunchDarkly, GrowthBook, Flagd, Unleash,
  ConfigCat). `@openfeature/server-sdk` stays *out* of peer deps — the
  consumer wires the client and passes it in.
- **`RedisCircuitBreaker`** ([resilience/redis-circuit-breaker.ts](resilience/redis-circuit-breaker.ts)) —
  distributed circuit breaker. State (failures, open timestamp, half-open
  successes) lives in a single Redis hash per breaker name, shared across
  all pods. Atomic state transitions via Lua scripts. Fails open on Redis
  unreachable so the control plane being down doesn't cause outages.
- **`VaultSecretManager`** ([secret/vault-secret-manager.ts](secret/vault-secret-manager.ts)) —
  Vault KV-v2 backed secret manager. Uses HTTP API directly (no
  `node-vault` SDK peer dep). Returns versioned secrets with Vault's own
  version field. Optional `SecretRotationEmitter` integration: emits a
  rotation event when a re-read returns a newer version. Auto-selected
  by `kms.provider: "vault"` in config.
- **`examples/`** ([examples/](examples/)) — 8 copy-paste-ready integration
  files: `01-app-bootstrap`, `02-audit`, `03-outbox-worker`, `04-rate-limit`,
  `05-feature-flags`, `06-resilience`, `07-multi-tenancy`, `08-secrets-vault`,
  plus a `README.md` index. Each file documents wiring + usage + anti-patterns
  for one module.

### Changed

- `SecretsModule.forRoot()` factory now dispatches on `kms.provider`:
  `"vault"` → `VaultSecretManager` (with rotation emitter wired in),
  `"local"` (default) → `LocalSecretManager`. Falls back to local with
  a warning if `vault` is requested but `vaultAddr`/`vaultToken` are missing.
- `tsconfig.json` `exclude` now lists `examples` so example files aren't
  emitted into `dist/`.

## [0.2.0]

Depth pass on every primitive plus the missing enterprise-grade capabilities.

### Added

- **`@alaska115/nextjs-toolkit/multi-tenancy`** — `TenantService` with `cacheKey()`,
  `rateLimitKey()`, `scopedWhere()` helpers + `TenantModule` (global).
- **`@alaska115/nextjs-toolkit/audit`**: `audit-chain` (tamper-evident SHA-256 hash chain)
  + `ActorResolver` (reads actor from request context) + auto-population in
  `AuditLogService.emit()`.
- **`@alaska115/nextjs-toolkit/outbox`**: `OutboxWorker` — generic polling loop with
  per-type subscriber dispatch, max-attempts cap, dead-letter handler, and
  graceful-shutdown integration.
- **`@alaska115/nextjs-toolkit/rate-limit`**: `SlidingWindowRateLimitAdapter` for
  burst-at-window-edge-free single-instance use; `RateLimitGuard` + `@RateLimit()`
  decorator with RFC 6585 `X-RateLimit-Remaining` / `Retry-After` headers and a
  sensible default key (`tenantId:userId:route`).
- **`@alaska115/nextjs-toolkit/feature-flags`**: deterministic percentage bucketing
  (`isInRolloutBucket()` + `FeatureFlagsService.inRollout()`) using SHA-256
  on `(flag, subject)`; kill-switch behavior on adapter failures
  (`isEnabled` → false, `getVariant` → fallback, always logs).
- **`@alaska115/nextjs-toolkit/resilience`**: `Bulkhead` (concurrency limiter with
  bounded queue) + `withDeadline()` / `getRemainingBudget()` /
  `withRemainingBudget()` (ALS-propagated deadlines that inherit
  `min(parent, requested)`). `retry()` now honors `Retry-After` headers
  / `.retryAfterMs` on thrown errors.
- **`@alaska115/nextjs-toolkit/secret`**: `SecretRotationEmitter` (in-process pub/sub
  for rotation events) + `canaryCheck()` helper for boot-time validation of
  required secret keys.
- **`LoggerService.event(event: LogEvent)`** — typed canonical-log entrypoint
  that complements the loose `info/warn/error/...` methods.
- **`LoggerService` auto-enriches with `tenantId`** alongside the existing
  request-context fields, and respects per-call overrides.
- **`TracingSpan.addEvent`** optional method for marking named moments inside
  a long-running span.
- **Documentation:** `docs/adr/` with ADRs 0001–0004; per-module READMEs for
  audit, resilience, multi-tenancy, outbox, rate-limit, feature-flags;
  `CONTRIBUTING.md` with conventional-commits spec, deprecation policy, and
  API stability tiers; `commitlint.config.js`.

### Changed

- TypeScript `noImplicitAny: true` (was `false`). 13 sites cleaned —
  4 actual implicit-any function parameters typed; 5 missing-types modules
  shimmed in `types/external-shims.d.ts` (and `@types/*` recommended for
  consumers who use those adapters).
- `AuditLogService.emit()` signature relaxed: `actor`, `tenantId`, `timestamp`,
  and `correlation` are all optional in the input — the service fills them.

### Fixed

- `TracingService.runInSpan` would dereference a possibly-undefined
  `tracingPort`; now falls back to running the function directly when
  the port isn't wired.

## [0.1.0]

First pre-1.0 cut focused on extracting the package as a standalone toolkit.

### Added

- **`@alaska115/nextjs-toolkit/audit`** — `AuditLogService`, `AuditLogContract` port,
  `DefaultAuditLogAdapter` (logger-backed). Auto-enriches events with request
  context (correlation IDs + tenant).
- **`@alaska115/nextjs-toolkit/feature-flags`** — `FeatureFlagsService` +
  `FeatureFlagContract` port, `StaticFeatureFlagsAdapter` for tests/dev.
- **`@alaska115/nextjs-toolkit/resilience`** — `withTimeout()`, `retry()` with
  exponential backoff + jitter, `CircuitBreaker` with `closed`/`open`/`half-open`
  state machine.
- **`@alaska115/nextjs-toolkit/rate-limit`** — `RateLimitContract` port,
  `InMemoryRateLimitAdapter` for single-instance rate limiting.
- **`tenantId`** on `RequestContext`. Pulled from `x-tenant-id` header or
  attached user object by `RequestContextInterceptor`.
- **`LogEvent`** canonical structured-log shape in `observability/logger`.
- **`redact()`** utility for scrubbing sensitive fields (auth headers, credentials,
  PII) from log payloads. Wired into `HttpExceptionFilter`.
- **`SecretManager.getVersionedSecret()` + `rotateSecret()`** for adapters that
  support rotation. `LocalSecretManager` now has `setSecret()` so dev seeding
  works.
- **`PrismaOptions.driverFactory`** — Prisma driver selection now configurable;
  default still `PrismaPg` (lazy-required).
- **Joi config validation** is now active (was commented out). Validates env
  var shape without forcing every secret to be set at boot.
- **DI token symbolification** — `ORM_HEALTH_CLIENT`, `ORM_KIND`,
  `HEALTH_INDICATORS`, `NOTIFICATION_PROVIDERS`, `NOTIFICATION_IDEMPOTENCY_STORE`
  are now exported `Symbol`s. String literals were a footgun (one already
  caused a real bug in `ObservabilityModule.forRoot()`).

### Changed

- **BREAKING**: `OrmType` narrowed from `"prisma" | "typeorm" | "inmemory"` to
  `"prisma" | "inmemory"`. `typeorm` was never implemented.
- **BREAKING**: `FileStorageService` dropped project-specific methods
  (`signupAttachmentUpload`, `saveSignupFileToStorage`,
  `getPrivateCitizenFileKeyForPersonalFiles`,
  `getPrivateCitizenFileKeyForApplicationFiles`,
  `getStagingKeyForTemporaryStorage`). Replaced with generic
  `uploadToBucket(file, bucket, key, metadata?)`. Consumers should compose
  the dropped flows in their own services.
- **BREAKING**: `FileStorageController` no longer exposes
  `/upload-signup-attachment`. Use `/upload-public-share` for generic public
  uploads or the consumer's own controllers for domain-specific flows.
- **BREAKING**: `getBucketNameFromDestination` moved from `utils` →
  `file-storage`.
- **BREAKING**: `USER_REPOSITORY` and `ORDER_REPOSITORY` symbols removed from
  `persistence.constants`. Define your own in the consumer service.
- **BREAKING**: `DATABASE_URL` is the canonical env var; the old
  `IDENTITY_LAYER_DATABASE_URL` is no longer read.
- **BREAKING**: All MDC-specific defaults removed from `configuration.ts`
  (hardcoded keycloak URLs, superadmin email, bucket names, BOMBOO provider
  default, literal secret fallbacks). Consumers must supply via env.
- `NotificationModule` no longer `@Global()` — consumers must import it where
  they need it.
- `ObservabilityModule` interceptors now use the `APP_INTERCEPTOR` symbol
  (was a string literal — fixed a real bug where 3 of 4 interceptors were
  silently not being registered).
- `WinstonLoggingAdapter` reads `logging.level` and `app.name` from
  `ConfigService` again (was previously hardcoded to `"info"` / `"mdc"`).
- `OtelTracingAdapter`, `WinstonLoggingAdapter`, `PrometheusMetricsAdapter`,
  `PrismaPg` are all lazy-required inside their module factories. Optional peer
  deps (`@opentelemetry/*`, `winston`, `prom-client`, `@prisma/adapter-pg`,
  etc.) are now genuinely optional.
- `InMemoryPersistenceAdapter` throws clear "no engine wired" errors instead
  of silent NPEs (`undefined.findUnique`).
- `bootstrap/cors-registration.ts` removed the redundant 405 middleware; fixed
  a silent `exposeHeaders` typo (correct property is `exposedHeaders`).
- `errors/http-exception.filter` no longer derives codes by snake-casing
  message arrays; uses HTTP status → `LogicalErrorCode` mapping. Unconditional
  `console.error` removed.
- `noopStorageAdapter` no longer returns `{} as ReadableStream` (silent data
  corruption). All methods now throw with a clear error.
- `shutdown.manager` log lines: emoji `✅` / `❌` replaced with text.
- `crypto.randomUUID()` calls switched to `import { randomUUID } from "node:crypto"`
  for Node 18.0–18.18 compatibility.
- `ShutdownManager` is now provided exclusively by `ShutdownModule`. Logger,
  tracing, and persistence modules no longer duplicate the registration.

### Removed

- `errors/gRPC-exception.filter.ts` references and the openapi-doc stub
  (transitional code, scheduled for deletion).
- `node-fetch`, `busboy` runtime dependencies (unused).

### Fixed

- `ObservabilityModule.forRoot()` interceptor registration (`"APP_INTERCEPTOR"`
  string → `APP_INTERCEPTOR` symbol).
- `ErrorTrackingService.errorCounter` NPE on first call (dead method removed).
- `InMemoryPersistenceAdapter` throwing `Cannot read properties of undefined` on
  every method (`inMemoryEngine` was never assigned).
- `HttpExceptionFilter` was leaking request `Authorization` / `Cookie` headers
  to the logger.

### Stability

This release is **pre-1.0**. Modules marked `// @internal` or modules without a
corresponding `forRoot()` may still change shape. See module-level JSDoc.
