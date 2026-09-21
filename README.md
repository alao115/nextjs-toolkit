# @alaska115/nextjs-toolkit

[![npm](https://img.shields.io/npm/v/@alaska115/nextjs-toolkit.svg)](https://www.npmjs.com/package/@alaska115/nextjs-toolkit)
[![license](https://img.shields.io/npm/l/@alaska115/nextjs-toolkit.svg)](./LICENSE)

Production plumbing for **NestJS + Express** services — the parts every backend
needs and nobody wants to write again. Nineteen independent subpath exports,
each built as a port with swappable adapters, so you take what you need and
nothing else.

```ts
import { LoggerService } from "@alaska115/nextjs-toolkit/observability";
import { BaseException } from "@alaska115/nextjs-toolkit/errors";
import { withTimeout, retry } from "@alaska115/nextjs-toolkit/resilience";
```

**📖 [Full documentation](./docs/)** · [Getting started](./docs/getting-started.md) ·
[Configuration](./docs/configuration.md) · [Troubleshooting](./docs/troubleshooting.md) ·
[Examples](./examples/)

---

## What's in the box

| Module | Subpath | What it gives you |
| ------ | ------- | ----------------- |
| [config](./docs/modules/config.md) | `/config` | Joi-validated env loading; one `ConfigurationModule` import. |
| [bootstrap](./docs/modules/bootstrap.md) | `/bootstrap` | `main.ts` helpers — global prefix + versioning + `ValidationPipe`, CORS, Helmet, CSP, Redis sessions, Swagger, ngrok, shutdown hook. |
| [context](./docs/modules/context.md) | `/context` | `AsyncLocalStorage` request scope: request/correlation/trace ids, user, tenant. |
| [errors](./docs/modules/errors.md) | `/errors` | `BaseException`, domain errors, and one filter that turns anything thrown into a canonical JSON body. |
| [observability](./docs/modules/observability.md) | `/observability` | Structured logging (Winston), tracing (OpenTelemetry), metrics (Prometheus), PII redaction, error tracking. |
| [persistence](./docs/modules/persistence.md) | `/persistence` | ORM-agnostic port, Prisma adapter, ALS-backed unit of work. |
| [cache](./docs/modules/cache.md) | `/cache` | Redis cache-manager store plus a raw `ioredis` client. |
| [health](./docs/modules/health.md) | `/health` | `/health`, `/health/ready`, `/health/live` with pluggable indicators, wired to the shutdown manager. |
| [shutdown](./docs/modules/shutdown.md) | `/shutdown` | Phased, ordered graceful shutdown built for Kubernetes rollouts. |
| [messaging](./docs/modules/messaging.md) | `/messaging` | Templated notifications (nodemailer + Twig) with retries and idempotency. |
| [security](./docs/modules/security.md) | `/security` | Argon2 password hashing, token hashing, AES-GCM envelope encryption. |
| [secret](./docs/modules/secret.md) | `/secret` | Secret manager port, Vault KV-v2 adapter, rotation events, boot-time canary. |
| [utils](./docs/modules/utils.md) | `/utils` | Prisma pagination builders, `catchError`, date helpers. |
| [audit](./docs/modules/audit.md) ⚗️ | `/audit` | Audit events with auto-resolved actors and a tamper-evident hash chain. |
| [feature-flags](./docs/modules/feature-flags.md) ⚗️ | `/feature-flags` | Flag port, OpenFeature bridge, deterministic percentage rollouts. |
| [multi-tenancy](./docs/modules/multi-tenancy.md) ⚗️ | `/multi-tenancy` | Tenant-scoped cache keys, rate-limit keys and query fragments. |
| [outbox](./docs/modules/outbox.md) ⚗️ | `/outbox` | Transactional outbox with a polling worker and DLQ. |
| [rate-limit](./docs/modules/rate-limit.md) ⚗️ | `/rate-limit` | Guard + `@RateLimit()` decorator; in-memory, sliding-window and Redis adapters. |
| [resilience](./docs/modules/resilience.md) ⚗️ | `/resilience` | Timeout, retry with `Retry-After`, circuit breaker (local and Redis), bulkhead, deadline propagation. |

⚗️ = experimental; the API may change before 1.0.

## Install

```bash
pnpm add @alaska115/nextjs-toolkit
# npm install @alaska115/nextjs-toolkit
# yarn add @alaska115/nextjs-toolkit
```

Peer dependencies stay under your control. The required set:

```bash
pnpm add @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 \
         @nestjs/config@^4 @nestjs/cache-manager@^3 @nestjs/swagger@^11 \
         cache-manager@^7 keyv@^5 \
         express@^4 rxjs@^7 reflect-metadata \
         class-validator@^0.14 class-transformer@^0.5
```

Everything else — Prisma, `prom-client`, OpenTelemetry, Sentry, `argon2`,
`nodemailer`, `twig`, `minio`, `@ngrok/ngrok` — is **optional** and only needed
by the modules that use it. See the
[per-module table](./docs/getting-started.md#1-install).

### TypeScript requirement

Subpath exports need a modern resolver:

```json
{ "compilerOptions": { "module": "node16", "moduleResolution": "node16" } }
```

`nodenext` and `bundler` work too; the legacy `node` / `node10` resolver does
not read `package.json` `exports` and will fail with
`Cannot find module '@alaska115/nextjs-toolkit/<subpath>'`.

**Node ≥ 18.**

## Quick start

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";
import { LoggerModule } from "@alaska115/nextjs-toolkit/observability";
import {
  RequestContextInterceptor,
  GlobalResponseInterceptor,
} from "@alaska115/nextjs-toolkit/context";
import { HttpExceptionFilter } from "@alaska115/nextjs-toolkit/errors";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";

@Module({
  imports: [
    ConfigurationModule,
    ShutdownModule,
    LoggerModule,
    HealthModule.forRoot({ enableDb: false, enableNotifications: false }),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

```ts
// main.ts
const app = await NestFactory.create(AppModule);
const config = app.get(ConfigService);

registerDefaults(app, config);
corsRegistration(app, config);
helmetRegistration(app);
registerShutdownAppHook(app);

await app.listen(config.get<number>("http.port") ?? 3001);
```

You now get, on every request: a correlation id threaded through every log line,
a `{ success, timestamp, correlationId, data }` envelope on success, a canonical
`{ status, code, message, details, correlationId }` body on failure, health
probes, and a clean drain on `SIGTERM`.

Walk through it in [Getting started](./docs/getting-started.md), or read
[`examples/mini-app`](./examples/mini-app/) — a runnable app that installs the
published package and exercises it end to end.

## Design

Four decisions shape everything, recorded as [ADRs](./docs/adr/):

- **[Ports and adapters at every boundary](./docs/adr/0001-port-adapter-everywhere.md)** —
  every external dependency sits behind a small interface with a no-op default,
  so nothing forces a vendor on you and tests need no network.
- **[Symbol DI tokens](./docs/adr/0002-symbol-di-tokens.md)** — no string token
  collisions across packages.
- **[Joi-validated config, no secret defaults](./docs/adr/0003-config-via-joi-no-secret-defaults.md)** —
  a bad env var fails the boot, not the first request; no secret ever has a
  literal fallback.
- **[Request scope in `AsyncLocalStorage`](./docs/adr/0004-request-context-als.md)** —
  correlation without threading a context argument through every signature.

## Local development

```bash
pnpm install
pnpm run build        # one-shot compile to dist/
pnpm run start:dev    # tsc --watch
pnpm test             # jest
pnpm run clean
```

To consume it locally without publishing:

```bash
pnpm pack                                      # → alaska115-nextjs-toolkit-<version>.tgz
# in the consumer project:
pnpm add /absolute/path/to/alaska115-nextjs-toolkit-<version>.tgz
```

`npm link`, a workspace, or [yalc](https://github.com/wclr/yalc) work too.

Before publishing, verify the package still works from a fresh install:

```bash
cd examples/mini-app && pnpm install && pnpm run smoke
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Publishing

Only `dist/` is published — source `.ts` files are excluded via the `files`
field, and `prepublishOnly` runs clean + build + test.

```bash
npm version <patch|minor|major>   # bumps version, creates a git tag
npm publish
git push --follow-tags
```

`publishConfig.access` is `public`. To publish elsewhere, add
`publishConfig.registry` (or pass `--registry`):

| Registry | URL |
| -------- | --- |
| npmjs.org (public) | `https://registry.npmjs.org` |
| GitHub Packages | `https://npm.pkg.github.com` |
| GitLab Package Registry | `https://gitlab.com/api/v4/projects/<PROJECT_ID>/packages/npm/` |
| Self-hosted Verdaccio | `https://your-verdaccio.example.com` |

## Compatibility

| | |
| --- | --- |
| Node | ≥ 18 |
| NestJS | 11.x |
| Express | 4.x |
| TypeScript | `moduleResolution`: `node16` / `nodenext` / `bundler` |

The package is pre-1.0: minor versions may contain breaking changes, flagged
with `!` in the [changelog](./CHANGELOG.md). Pin a minor version in production.

## License

MIT © see [LICENSE](./LICENSE)
