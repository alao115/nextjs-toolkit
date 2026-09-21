# Documentation

Reference documentation for `@alaska115/nextjs-toolkit`.

## Start here

| Guide | What it covers |
| ----- | -------------- |
| [Getting started](./getting-started.md) | Empty NestJS service → running app with config, logging, correlation, errors, health and graceful shutdown. |
| [Configuration reference](./configuration.md) | Every env var, the config key it maps to, and which module reads it. |
| [Troubleshooting](./troubleshooting.md) | The failure modes people actually hit, and the fix for each. |

## Modules

Each page documents the full public surface of one subpath export.

| Module | Subpath | What it gives you |
| ------ | ------- | ----------------- |
| [config](./modules/config.md) | `/config` | Joi-validated env loading, `ConfigurationModule`. |
| [bootstrap](./modules/bootstrap.md) | `/bootstrap` | `main.ts` helpers: prefix + versioning + validation, CORS, Helmet, CSP, sessions, Swagger, ngrok, shutdown hook. |
| [context](./modules/context.md) | `/context` | `AsyncLocalStorage` request scope — correlation ids, user, tenant. |
| [errors](./modules/errors.md) | `/errors` | `BaseException`, domain errors, the canonical error filter. |
| [observability](./modules/observability.md) | `/observability` | Logging, tracing, metrics, redaction, error tracking. |
| [persistence](./modules/persistence.md) | `/persistence` | ORM-agnostic port, Prisma adapter, ALS unit of work. |
| [cache](./modules/cache.md) | `/cache` | Redis cache-manager store plus a raw `ioredis` client. |
| [health](./modules/health.md) | `/health` | Liveness / readiness endpoints with pluggable indicators. |
| [shutdown](./modules/shutdown.md) | `/shutdown` | Phased, ordered graceful shutdown. |
| [messaging](./modules/messaging.md) | `/messaging` | Templated notifications with retries and idempotency. |
| [security](./modules/security.md) | `/security` | Argon2 hashing, token hashing, envelope encryption. |
| [secret](./modules/secret.md) | `/secret` | Secret manager port, Vault adapter, rotation events, boot canary. |
| [utils](./modules/utils.md) | `/utils` | Prisma pagination builders and small helpers. |
| [audit](./modules/audit.md) ⚗️ | `/audit` | Structured audit events with a tamper-evident hash chain. |
| [feature-flags](./modules/feature-flags.md) ⚗️ | `/feature-flags` | Flag port, OpenFeature bridge, deterministic % rollouts. |
| [multi-tenancy](./modules/multi-tenancy.md) ⚗️ | `/multi-tenancy` | Tenant-scoped keys and query fragments. |
| [outbox](./modules/outbox.md) ⚗️ | `/outbox` | Transactional outbox + polling worker. |
| [rate-limit](./modules/rate-limit.md) ⚗️ | `/rate-limit` | Guard, decorator, in-memory / sliding-window / Redis adapters. |
| [resilience](./modules/resilience.md) ⚗️ | `/resilience` | Timeout, retry, circuit breaker, bulkhead, deadlines. |

⚗️ = experimental; the API may change before 1.0. Pin a minor version if you
depend on the exact shape.

## Examples

| | |
| --- | --- |
| [`examples/`](../examples/) | Copy-paste integration snippets, one per concern. |
| [`examples/mini-app/`](../examples/mini-app/) | A runnable NestJS app that installs the published package and exercises it end to end, with a smoke test. |

## Design decisions

[Architecture Decision Records](./adr/) record why the package is shaped the way
it is:

| ADR | Title |
| --- | ----- |
| [0001](./adr/0001-port-adapter-everywhere.md) | Port/Adapter pattern for every external boundary |
| [0002](./adr/0002-symbol-di-tokens.md) | All DI tokens are `Symbol`s, never strings |
| [0003](./adr/0003-config-via-joi-no-secret-defaults.md) | Config is Joi-validated; secrets have no literal defaults |
| [0004](./adr/0004-request-context-als.md) | Request scope lives in `AsyncLocalStorage` |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) and the [changelog](../CHANGELOG.md).
