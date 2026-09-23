# Changelog

All notable changes to `@alaska115/nextjs-toolkit` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0]

### Changed


- **The package now ships both CommonJS and ESM.** `dist/cjs` and `dist/esm`
  are built from the same sources by two `tsc` passes, and every subpath in
  `exports` carries `types` / `import` / `require` conditions. Existing
  CommonJS consumers are unaffected; ESM consumers stop going through Node's
  CJS interop. This is the groundwork for NestJS 12, which is ESM-only.

  Deliberately **not** bundled: bundling 20 entrypoints duplicates shared
  modules into each one, which would give every entrypoint its own copy of the
  `Symbol` DI tokens and of the `AsyncLocalStorage` instances behind
  `RequestContextService` — silently breaking provider resolution and request
  context.

- **DI tokens moved from `Symbol()` to `Symbol.for()`**, namespaced as
  `@alaska115/nextjs-toolkit:<NAME>`. A dual-format package can be loaded twice
  in one process (some dependencies `require` it while the app `import`s it),
  and unique symbols would differ between the two copies — so `@Inject(TOKEN)`
  would silently fail to resolve. Registry symbols are identical across copies.
  This is invisible unless you compared tokens by identity across a mixed
  require/import graph. See [ADR 0002](./docs/adr/0002-symbol-di-tokens.md).

- `vitest.config.ts` and `scripts/` are excluded from the build. The build
  tsconfig's `include: ["**/*.ts"]` was compiling the root config file into both
  `dist/cjs/vitest.config.js` and `dist/esm/vitest.config.js`, shipping test
  configuration to consumers.

- **Relative imports now carry explicit `.js` extensions** (384 specifiers
  across 146 files). Node's ESM resolver requires them; TypeScript maps them
  back to `.ts`, and the CommonJS build is unaffected.

- **`esModuleInterop` enabled**, and namespace imports of CommonJS
  dependencies (`import * as Joi from "joi"`) rewritten to default imports.
  Under ESM a CommonJS module's callable exports live on `default`, so
  `Joi.string()` was `undefined` — `/config` failed to load at all when
  imported as ESM.


- **BREAKING CHANGE: the package now targets NestJS 12.** `@nestjs/common`,
  `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`,
  `@nestjs/config` and `@nestjs/cache-manager` peer ranges all move to
  `^12.0.0`, and `engines.node` becomes
  `^20.19.0 || ^22.12.0 || >=24.0.0` — Nest 12 is ESM-only, and those are the
  Node versions with `require(esm)`.

  **Nest 12 being ESM-only affects your application, not just this package.**
  TypeScript will not emit a `require` for it from a CommonJS file (`TS1479`),
  so a consuming app generally needs `"type": "module"`, `node16`/`nodenext`
  resolution, and explicit `.js` extensions on relative imports. Compile with
  `tsc`: esbuild-based runners such as `tsx` cannot emit `design:paramtypes`,
  and Nest constructor injection silently resolves every dependency to
  `undefined` without it. `examples/mini-app` was converted accordingly and is
  a working reference.

  `@nestjs/config@12` also switched to Standard Schema. Joi 18 implements it,
  so the existing schema works unchanged, but vendor-specific
  `validationOptions` no longer type-check — v12 already defaults Joi to
  `{ abortEarly: false, allowUnknown: true }`, so the toolkit's block was
  simply removed. Override via `validationOptions: { libraryOptions: {...} }`.

  Migration: upgrade to NestJS 12, or pin `@alaska115/nextjs-toolkit@^0.7.0`.

  This also fixes a peer set that was **unsatisfiable** on 0.7.0:
  `@nestjs/swagger@^11` requires `@nestjs/common@^11.0.1` while the toolkit
  pinned `@nestjs/common@^10.0.0`, so `npm install` refused the combination the
  README prescribed unless the consumer passed `--legacy-peer-deps`. pnpm's
  `autoInstallPeers` resolved it quietly, which is why it went unnoticed.

- **Tests run on Vitest instead of Jest.** Jest's CommonJS runtime cannot load
  ESM-only dependencies, and transforming Nest 12 down to CJS fails on
  `import.meta`. All 197 tests carried over.

- **`cache-manager` and `keyv` are now declared peer dependencies.** They are
  peers of `@nestjs/cache-manager` that the install instructions omitted, so
  the `cache` subpath — and the package root, which re-exports it — failed to
  load with `MODULE_NOT_FOUND: cache-manager` on a clean npm install.

- `@nestjs/common`, `@nestjs/core` and `@nestjs/platform-express` added to
  `devDependencies`. They were absent, so the build and test run only resolved
  Nest because pnpm's `autoInstallPeers` filled them in.

- `examples/mini-app/pnpm-lock.yaml` is no longer committed. It pinned
  `@alaska115/nextjs-toolkit` to `file:../../alaska115-nextjs-toolkit-0.4.1.tgz`
  — a tarball that is not in the repository and is excluded by `.gitignore` —
  so a fresh clone could not install the example at all.

### Fixed

- **Every email was sent with an empty body.** `EmailProvider` calls the
  transport with `html: rendered.body`, but `NodemailerEmailAdapter.sendMail`
  read `payload.template` — the template *key*, which is never passed — so
  `html` was always `undefined`. It now sends `payload.html ?? payload.body`,
  and honours the payload's `from` instead of always overriding it with
  `mail.sender`.

- **The email health check sent a real email on every probe.**
  `NodemailerEmailAdapter.checkHealth()` was nodemailer's Ethereal sample code:
  it created a throwaway test account over the network and sent a hardcoded
  "Hello to myself!" message from `sender@example.com`, printing credentials and
  preview URLs to stdout. It never touched the configured transport, so it
  reported "up" whether or not the real SMTP server was reachable — and since
  `HealthModule`'s `enableNotifications` defaults to on, a Kubernetes readiness
  probe triggered this every few seconds.

  Replaced with `transporter.verify()`, which checks SMTP connectivity and auth
  and sends nothing. Both bugs now have regression tests.


- **Six of the nineteen subpath exports could not be loaded with only the
  required peer dependencies installed**, because optional peers were imported
  statically:

  | Subpath | Failed on |
  | --- | --- |
  | root, `cache` | `cache-manager` (see above) |
  | `health`, `messaging` | `nodemailer` |
  | `bootstrap` | `@ngrok/ngrok` |
  | `security` | `argon2` |
  | root, `observability` | `prom-client` |

  `HealthModule.forRoot({ enableNotifications: false })` still crashed, because
  the import chain resolves before any option is read. `MetricsModule` already
  `require`d its Prometheus adapter lazily, but `observability/metrics/index.ts`
  re-exported the same adapter statically, which defeated it.

  All of these now load on first use, with an actionable error naming the
  package to install. `prom-client` and `@opentelemetry/api` in
  `NotificationService` degrade to no-ops instead of throwing, since neither is
  needed to deliver a notification. CI asserts every subpath loads in a
  consumer that has only the required peers.

- **Health endpoints always returned HTTP 200.** `HealthHttpController`
  returned the payload without setting a status, so a `"degraded"` or `"down"`
  result still answered 200. Kubernetes probes, load balancers and uptime
  monitors key on the status code, so a broken instance stayed in rotation and
  the drain coordination in `ShutdownManager` was unreachable in practice.

  The controller now throws `ServiceUnavailableException` carrying the full
  `HealthStatus` when the result is not `"ok"`, giving `503`. `/health/live`
  still answers 200 whenever the process is alive.

  Setting the status via `@Res({ passthrough: true })` does not work here:
  Nest resolves a default status per HTTP method and `ExpressAdapter.reply`
  applies it over anything the handler set.

- **SMS and WhatsApp notifications reported success and delivered nothing.**
  `NotificationModule` registered `SmsProvider` and `WhatsAppProvider` backed by
  clients that only `console.log`'d and returned a fake message id, so
  `send({ channel: "sms" })` resolved with `success: true`.

  Those providers are no longer registered. `NotificationService` now throws
  `No notification provider registered for channel: sms`, surfacing the missing
  wiring. Override `NOTIFICATION_PROVIDERS` to enable the channel;
  `SmsProvider` / `WhatsAppProvider` still ship, so supplying an `SmsClient` or
  `WhatsAppClient` is all that is needed.

- **`ObservabilityModule.forRoot()` options replaced the defaults instead of
  merging.** `forRoot({ metrics: false })` left `logging`, `tracing` and
  `errorTracker` `undefined`, which read as disabled — so opting out of metrics
  silently turned off all telemetry. Options are now merged over the defaults.

- **`PrismaService` logged every SQL statement unconditionally** at `info`, with
  no way to turn it off. Query text routinely carries personal data and
  credentials in literals. Now opt-in via `logQueries: true` on
  `AppPersistenceConfig`, defaulting to off.

- **`LoggerModule` crashed at import without the optional `@sentry/node`.**
  `ErrorTrackingModule` statically imported the Sentry adapter, which statically
  imports `@sentry/node`; `LoggerModule` imports `ErrorTrackingModule`. So the
  logger — the module the getting-started guide recommends first — failed with
  `MODULE_NOT_FOUND: @sentry/node` for anyone who had not installed an
  *optional* peer dependency. pnpm's `autoInstallPeers` masked this; npm did not.

  The adapter is now `require`d lazily, and only when `SENTRY_DSN` is set. If
  the DSN is set but the package is absent, boot logs a warning and error
  tracking stays a no-op instead of taking the process down.

- **`computeAuditHash` did not hash the event contents.** The canonical
  serialization used `JSON.stringify(value, keyArray)`, but an **array**
  replacer is a property allow-list applied at *every* nesting depth — so the
  allow-list `["event", "previousHash", "sequence"]` stripped every field of the
  event itself. Each record hashed `{"event":{},...}`, meaning the
  "tamper-evident" chain detected only sequence and link manipulation.
  `verifyAuditChain` reported an intact chain after any content edit: flipping
  `outcome` from `"denied"` to `"success"`, rewriting the actor, or changing the
  action all left the hash unchanged.

  Replaced with a recursive key-sorting canonicalizer. `audit-chain.ts` now has
  test coverage for every tamper scenario (mutated payload, deleted record,
  reordering, re-pointed `previousHash`, forged prefix, rewritten hash).

  **Hash values change.** Chains sealed by an earlier version will not verify
  against this one. Because the hash was not covering event contents, those
  chains never carried the guarantee they claimed — treat them as unverifiable
  rather than re-sealing them, which would only launder whatever they contain.
  If you need continuity, archive the old rows and start a new chain.

### Added

- **ESLint 9 + typescript-eslint**, via `eslint.config.mjs`, with `pnpm run lint`
  and `lint:fix`. The config documents why `any` and `require()` are permitted
  where they are, and scopes `no-console` to the three places the console is the
  intended sink. Running it for the first time surfaced the two email bugs above
  and three of the dead files below.

- **`tsconfig.spec.json` + `pnpm run typecheck:tests`.** Test files were never
  type-checked by anything: the build tsconfig excludes `*.spec.ts`, and ts-jest
  compiled them with an inline `strict: false`. ts-jest now uses this config too,
  so tests are held to the same strictness as the package.

- **`pnpm run verify`** — lint, typecheck, typecheck:tests and test in one
  command. `prepublishOnly` runs lint and the test typecheck as well.

- **`.editorconfig`**, matching the tab indentation the source already uses.

- **`./package.json` added to `exports`**, so tooling can read the manifest.


- `AppPersistenceConfig.logQueries` — opt in to Prisma SQL statement logging.
- `SERVICE_UNAVAILABLE` added to `LogicalErrorCode`, and `HttpExceptionFilter`
  now maps HTTP 503 to it rather than falling through to `INTERNAL_ERROR`.
- Tests for `HealthHttpController` covering the status-code contract on every
  endpoint, including the draining case.
- CI: GitHub Actions workflow running build + tests on Node 18/20/22,
  a production-dependency audit, commitlint on pull requests, and a
  consumer smoke test that packs the tarball and installs it into
  `examples/mini-app`.
- `packageManager: pnpm@9.15.4` pinned in `package.json`, so contributors and CI
  resolve the same pnpm as the committed `lockfileVersion: 9.0`.
- Tests for previously uncovered security-sensitive code: the audit hash chain,
  `security/crypto.util` (Argon2 hashing, token generation and hashing),
  `security/encryption.util` (AES-256-GCM envelope round-trips plus tamper
  rejection), `multi-tenancy/tenant.service` (including that `scopedWhere`
  throws rather than emitting an unscoped query, and that it overrides a
  caller-supplied `tenantId`), `feature-flags/bucketing` (determinism,
  uniformity, monotonicity across ramps), and the `secret` module
  (`LocalSecretManager`, `SecretRotationEmitter`, `canaryCheck`).

  Suite goes from 68 tests to 176; statement coverage from 17.9% to 25.1%, with
  each of the above files at 94–100%.

- Documentation suite under `docs/` covering all 19 subpath exports, plus a
  configuration reference, getting-started guide and troubleshooting guide.

### Removed

- **`file-storage/` source deleted.** Its subpath export went in 0.7.0; the 18
  files stayed in the repository, excluded from the build, where they invited
  imports that could not resolve. `git show v0.7.0:file-storage` has the last
  copy, and `0.6.x` still ships it. The `minio` peer dependency and keyword are
  gone with it — no code referenced the library any more. The `files.*` and
  `minio.*` **config keys are kept**, since services built on the toolkit may
  already read them for their own storage wiring.

- **Dead code deleted:** `observability/obervability.module_old.ts` (superseded,
  misspelled, excluded from the build), `observability/tracing/shutdown-trace.hooks.ts`
  (`TracingShutdownHook` was referenced nowhere), `errors/gRPC-exception.filter.ts`
  (entirely commented out — `catch()` returned `{} as any` — and never exported),
  and `NodemailerEmailAdapter.renderTemplate` (a `<p>${data.content}</p>` stub;
  rendering belongs to `INotificationTemplateEngine`).

- **`change-case` dropped from dependencies.** Nothing imported it.

## [0.7.0]

### Removed

- **BREAKING CHANGE: `@alaska115/nextjs-toolkit/file-storage` subpath
  export removed.** The module — `FileStorageModule`, `FileStorageService`,
  `IStorageAdapter`, `IUploadedFile`, the MinIO / disk / noop adapters,
  the `FileEntity` / `FileStorageRepository`, and the `getBucketNameFromDestination`
  helper — is no longer reachable via `@alaska115/nextjs-toolkit/file-storage`
  or via the root re-export.

  Why: the module mixed too many concerns for a generic toolkit
  (project-specific path schemes leaked back in via PRs, the
  `IStorageAdapter` interface had most methods optional which made type-safe
  composition fragile, and consumers who use neither MinIO nor multer-disk
  were still paying the install + type-check cost). Pulling it out clarifies
  the toolkit's scope.

  Migration: if you depended on this module, either:
  - **Pin to `^0.6.0`** and consume from there until you're ready to take
    over the code yourself.
  - **Lift the source** out of `0.6.0` into your own service — it's ~600
    lines, depends only on the toolkit's `observability` / `persistence`
    modules, and is self-contained.
  - **Use the adapter directly** — `minio`, `@aws-sdk/client-s3`, etc. are
    straightforward to wire from scratch when you only need one bucket.

- `examples/12-file-storage.ts` deleted (the reference snippet for the
  removed module).

## [0.6.0]

### Changed

- **BREAKING CHANGE: `registerSwagger()` signature.**
  Now takes an options object: `registerSwagger({ enabled, app, config })` instead of `registerSwagger(app, config)`.

  ```diff
  - registerSwagger(app, config);
  + registerSwagger({
  +   enabled: config.get<boolean>("swagger.enabled") === true,
  +   app,
  +   config,
  + });
  ```

  Why (same reasoning as the 0.5.0 `SetupNgrokProxyModule.setup` change):
  - **Caller-owned enable decision.** Previously the function read
    `swagger.enabled` from config itself and silently no-op'd if false.
    Now the caller composes the predicate and the function does what it's
    asked.
  - **Fail-fast on missing required config.** When `enabled: true`,
    `swagger.title` and `swagger.version` are validated as present;
    missing keys raise a clear `Error` at boot instead of producing a
    Swagger spec with empty/default fields that fail downstream tooling
    (codegen, lint, doc rendering).

  `swagger.description`, `swagger.server`, `swagger.outputPath`, and
  `http.globalPrefix` remain optional with sensible defaults.

  Migration: pass `enabled` explicitly and ensure `SWAGGER_TITLE` /
  `SWAGGER_VERSION` are set in your env when you enable Swagger. If you
  don't use Swagger, pass `enabled: false`.

## [0.5.1]

### Fixed

- `SetupNgrokProxyModule.setup({ enabled: true })` no longer requires
  `ngrok.domain`. Domain is optional in ngrok itself — when omitted, ngrok
  generates a random `*.ngrok-free.app` subdomain. The 0.5.0 release
  incorrectly required it, which broke the common dev case of just wanting
  a tunnel without a reserved domain. Required keys are now only `http.port`
  and `ngrok.token`; if `ngrok.domain` is set we pass it through, otherwise
  we leave it out of the `ngrok.connect()` call.

## [0.5.0]

### Changed

- **BREAKING CHANGE: `SetupNgrokProxyModule.setup()` signature.**
  Now takes an options object: `setup({ enabled, config })` instead of `setup(config)`.

  ```diff
  - SetupNgrokProxyModule.setup(config);
  + SetupNgrokProxyModule.setup({
  +   enabled: config.get<string>("app.env") !== "production"
  +     && config.get<boolean>("ngrok.enabled") === true,
  +   config,
  + });
  ```

  Why:
  - **Caller-owned enable decision.** The previous behavior silently no-op'd when `app.env === "production"` OR `ngrok.enabled !== true`, which hid two unrelated decisions inside one function. Splitting them out means the caller can compose their own predicate (e.g. "only on staging if the dev flag is also set") and the function does what they asked.
  - **Fail-fast on missing config.** When `enabled: true`, the function now validates that `http.port`, `ngrok.token`, and `ngrok.domain` are all set and throws a clear `Error` listing the missing keys if any are absent. Previously, the underlying `ngrok.connect()` call would fail asynchronously after boot with a less helpful message, or worse, with a default upstream URL the consumer didn't intend.

  Migration: pass the previous implicit conditions explicitly via `enabled`. If you don't use ngrok, pass `enabled: false`.

## [0.4.2]

Two real bugs surfaced by the `mini-app` smoke harness — both blocked any
consumer that imported the observability modules directly.

### Added

- **`ContextModule`** ([context/context.module.ts](context/context.module.ts)) —
  `@Global()` module that provides + exports `RequestContextService`.
  `LoggerModule`, `TracingModule`, and `MetricsModule` now import it
  transitively, so consumers wiring any of them get a working
  `RequestContextService` without having to register the provider
  themselves. (Previously: consumers had to add `RequestContextService`
  to their app module's providers manually, or hit
  `Nest can't resolve dependencies of the LoggerService (RequestContextService)`.)

### Fixed

- **`LoggerService` couldn't be instantiated when consumers imported
  `LoggerModule` directly.** The `ErrorTrackingService` constructor
  parameter was required, but `LoggerModule` didn't import
  `ErrorTrackingModule`. **Fix:** mark `errorTracker` as `@Optional()`,
  guard the `captureError` call with `?.`, and have `LoggerModule` import
  `ErrorTrackingModule` so the service IS available when wanted.
- **`PrometheusMetricsAdapter` crashed at construction** with
  `Cannot read properties of undefined (reading 'Registry')` because the
  default import `import client from "prom-client"` evaluates to
  `undefined` under strict ESM interop (prom-client is CJS with no
  default export). **Fix:** switch to `import * as client from "prom-client"`
  + `import type { Counter, Histogram }`. Now metrics work when consumers
  set `OBSERVABILITY_METRICS=prometheus` and install `prom-client`.

### Notes

- The `mini-app` example was updated to import `LoggerModule` / `TracingModule` /
  `MetricsModule` directly (without the `ObservabilityModule.forRoot()` wrapper)
  to prove both fixes end-to-end. 14/14 smoke checks now pass against the
  package from npm.

## [0.4.1]

First release published from the standalone repository at
[github.com/alao115/nextjs-toolkit](https://github.com/alao115/nextjs-toolkit).

### Added

- **`repository`, `homepage`, `bugs`** fields in `package.json` so the npm
  package page links back to the GitHub repo and issue tracker.
- **`LICENSE`** file (MIT) shipped with the package. Previously only declared
  via `"license": "MIT"` in package.json.

### Fixed

- Renamed `observability/tracing/traacing.interceptor.ts` →
  `tracing.interceptor.ts` (longstanding typo). Updated the barrel re-export.
  Externally observable only via `dist/observability/tracing/...` filenames.
- `TracingInterceptor`: typed the rxjs `Observable` subscriber lambda
  explicitly to satisfy `noImplicitAny`.

### Changed

- Build now depends on `rxjs`, `class-transformer`, `class-validator`, and
  `reflect-metadata` being declared in `peerDependencies` (consumers
  always had them transitively via NestJS; the explicit declaration
  matches what was always required). Optional peers via
  `peerDependenciesMeta` for `class-transformer` / `class-validator` since
  only the pagination DTOs touch them.

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
