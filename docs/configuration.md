# Configuration reference

Every environment variable the package reads, the config key it lands on, and
which module consumes it.

Validation happens once, at boot, via `configValidationSchema` (Joi) inside
[`ConfigurationModule`](./modules/config.md). Unknown variables are allowed
through untouched; invalid ones fail the boot with every error reported at once.

Read config through `ConfigService.get("<key>")`, never `process.env`, so the
defaults and coercions below actually apply.

## App

| Env var             | Config key           | Default         | Notes |
| ------------------- | -------------------- | --------------- | ----- |
| `NODE_ENV`          | `nodeEnv`            | `development`   | One of `development`, `test`, `staging`, `production`. |
| `APP_NAME`          | `app.name`           | `app`           | |
| `APP_ENV`           | `app.env`            | `development`   | Same enum as `NODE_ENV`. |
| `APP_MODE`          | `app.mode`           | `monolith`      | `monolith` \| `microservice` \| `worker`. |
| `GENERATE_API_DOCS` | `app.generateAPIDocs`| `false`         | When true, `registerSwagger` also writes the OpenAPI JSON to disk. |
| `FRONTEND_URL`      | `app.frontendUrl`    | `http://localhost:3000` | |
| `DASHBOARD_URL`     | `app.dashboardUrl`   | `http://localhost:3000` | |
| `BASE_URL`          | `app.baseUrl`        | `http://localhost:3001` | |
| —                   | `app.includeFileTransport` | `false`   | Hard-coded; no env var today. |

## HTTP and CORS

| Env var              | Config key           | Default | Consumed by |
| -------------------- | -------------------- | ------- | ----------- |
| `HTTP_PORT`          | `http.port`          | `3001`  | your `main.ts`, `SetupNgrokProxyModule` |
| `HTTP_GLOBAL_PREFIX` | `http.globalPrefix`  | `api`   | `registerDefaults`, `registerSwagger` |
| —                    | `http.apiVersion`    | `"1"`   | `registerDefaults` (URI versioning); hard-coded. |
| `CORS_ENABLED`       | `cors.enabled`       | `true`  | `corsRegistration` |
| `CORS_ORIGINS`       | `cors.origin`        | `*`     | `corsRegistration` |

> `cors.enabled` is `process.env.CORS_ENABLED === "true" || true` — it is
> **always true**. Setting `CORS_ENABLED=false` does not disable CORS; skip the
> `corsRegistration(app, config)` call instead.

## Database

| Env var        | Config key   | Default | Notes |
| -------------- | ------------ | ------- | ----- |
| `DATABASE_URL` | `db.url`     | —       | Validated as a URI with a `postgres`/`postgresql`/`mysql`/`sqlite`/`file` scheme. |
| `DB_HOST`      | `db.host`    | —       | |
| `DB_PORT`      | `db.port`    | `5432`  | |
| `DB_USER`      | `db.user`    | —       | |
| `DB_PASSWORD`  | `db.password`| —       | |
| `DB_NAME`      | `db.name`    | —       | |
| `DB_RUN_MIGRATIONS` | —       | —       | Validated but not mapped into the config tree. |
| `ORM_TYPE`     | —            | —       | Validated (`prisma` \| `inmemory`) but not mapped. See the note on `persistence.*` below. |

## Redis, brokers

| Env var          | Config key    | Default         | Consumed by |
| ---------------- | ------------- | --------------- | ----------- |
| `REDIS_URL`      | `redis.url`   | —               | [`cache`](./modules/cache.md), `registerExpressSession` |
| `RMQ_URL`        | `rmq.url`     | —               | your code |
| `RMQ_QUEUE`      | `rmq.queue`   | `default_queue` | your code |
| `KAFKA_BROKER`   | `kafka.broker`| —               | your code |
| `KAFKA_GROUP_ID` | `kafka.groupId` | —             | your code |

## Observability

| Env var                  | Config key                        | Default      | Notes |
| ------------------------ | --------------------------------- | ------------ | ----- |
| `OBSERVABILITY_LOGGING`  | `observability.loggingProvider`   | `winston`    | `winston` \| `console` |
| `OBSERVABILITY_TRACING`  | `observability.tracingProvider`   | `otel`       | `otel` \| `noop` |
| `OBSERVABILITY_METRICS`  | `observability.metricsProvider`   | `prometheus` | `prometheus` \| `noop` |
| `LOG_LEVEL`              | `logging.level`                   | `info`       | `debug` \| `info` \| `warn` \| `error` |
| `LOG_DIR`                | `logging.dir`                     | `logs`       | |
| `LOG_FILE`               | `logging.file`                    | `api`        | |
| `LOG_DISPLAY_CONSOLE`    | `logging.displayConsole`          | `false`      | |
| —                        | `observability.enabledLog/Tracing/Metrics` | `true` | Hard-coded; toggle via `ObservabilityModule.forRoot()` instead. |

`SERVICE_NAME` and `NODE_ENV` are read straight from `process.env` by
`PrometheusMetricsAdapter` for its default `service` / `env` labels.

## Auth and sessions

None of these are consumed by the package itself except the cookie keys used by
`registerExpressSession`; they exist so a service built on the toolkit has one
validated place for them.

| Env var                      | Config key                          | Default |
| ---------------------------- | ----------------------------------- | ------- |
| `AUTH_MODE`                  | `auth.mode`                         | `jwt`   |
| `JWT_SECRET`                 | `auth.jwt.secret`                   | — (min 16 chars) |
| `JWT_REFRESH_SECRET`         | `auth.jwt.refreshSecret`            | — |
| `JWT_CITIZEN_SECRET`         | `auth.jwt.citizenSecret`            | — |
| `JWT_CITIZEN_REFRESH_SECRET` | `auth.jwt.citizenRefreshSecret`     | — |
| `JWT_ACCESS_TTL`             | `auth.jwt.accessTokenTtlSec`        | `300` |
| `JWT_REFRESH_TTL`            | `auth.jwt.refreshTokenTtlSec`       | `2592000` (30d) |
| `SESSION_SECRET`             | `auth.cookie.secret`                | — (min 16 chars) |
| `SESSION_COOKIE_NAME`        | `auth.cookie.name`                  | `sid` |
| `SESSION_COOKIE_DOMAIN`      | `auth.cookie.domain`                | — |
| —                            | `auth.cookie.secure`                | `NODE_ENV === "production"` |
| —                            | `auth.cookie.sameSite` / `httpOnly` | `lax` / `true` |
| `MAX_FAILED_AUTH`            | `auth.maxFailedAuthBeforeLock`      | `10` |
| `LOCKOUT_DURATION`           | `auth.lockoutDurationSec`           | `900` |
| `SUPER_ADMIN_EMAIL`          | `auth.superAdminEmail`              | — |
| `SUPER_ADMIN_TEMP_PASSWORD`  | `auth.superAdminTempPassword`       | — |

Keycloak / portal keys (`KEYCLOAK_BASE_URL`, `KEYCLOAK_ISSUER`,
`KEYCLOAK_ADMIN_URL`, `CITIZEN_PORTAL_REDIRECT_URI`, `CITIZEN_PORTAL_CLIENT_ID`,
`ADMIN_PORTAL_REDIRECT_URI`, `ADMIN_PORTAL_CLIENT_ID`, `IOS_SERVICE_SECRET`,
`IOS_SERVICE_CLIENT_ID`) map onto `auth.*` with the same names in camelCase.
They are mapped but **not** in the Joi schema.

## Secrets / KMS

| Env var            | Config key          | Default | Consumed by |
| ------------------ | ------------------- | ------- | ----------- |
| `KMS_PROVIDER`     | `kms.provider`      | `local` | [`secret`](./modules/secret.md) — `local` \| `aws-kms` \| `gcp-kms` \| `vault` |
| `VAULT_ADDR`       | `kms.vaultAddr`     | —       | `VaultSecretManager` |
| `VAULT_TOKEN`      | `kms.vaultToken`    | —       | `VaultSecretManager` |
| `LOCAL_MASTER_KEY` | `kms.localMasterKey`| —       | your code |
| `AWS_REGION`       | `kms.awsRegion`     | —       | your code |
| `AWS_KMS_KEY_ID`   | `kms.awsKmsKeyId`   | —       | your code |

Only `local` and `vault` are implemented; `aws-kms` and `gcp-kms` pass
validation but fall through to `LocalSecretManager`.

## Mail, SMS, OTP

| Env var                      | Config key              | Default  | Consumed by |
| ---------------------------- | ----------------------- | -------- | ----------- |
| `MAIL_HOST`                  | `mail.host`             | —        | [`messaging`](./modules/messaging.md) |
| `MAIL_PORT`                  | `mail.port`             | `25`     | |
| `MAIL_USER` / `MAIL_PASSWORD`| `mail.user` / `.password` | —      | |
| `MAIL_SENDER`                | `mail.sender`           | —        | falls back to `no-reply@example.com` |
| `MAIL_SECURE`                | `mail.secure`           | `false`  | |
| `MAIL_TEMPLATE_ENGINE`       | `mail.templateEngine`   | `twig`   | `twig` \| `default` |
| `NOTIFICATION_TEMPLATES_DIR` | `mail.templatesDir`     | —        | |
| `MAIL_PROVIDER`              | `mail.provider`         | —        | `bomboo` selects the Bomboo adapter |
| `BOMBOO_API_KEY`             | `mail.bomboo.api_key`, `sms.bomboo.api_key` | — | |
| `BOMBOO_EMAIL_URL`           | `mail.bomboo.email_url` | —        | |
| `BOMBOO_SMS_URL`             | `sms.bomboo.sms_url`    | —        | |
| `SMS_PROVIDER`               | `sms.provider`          | —        | |
| `OTP_TTL_SECONDS`            | `otp.ttlSeconds`        | `600`    | your code |
| `OTP_RESEND_COOLDOWN`        | `otp.resendCooldownSeconds` | `60` | |
| `OTP_MAX_ATTEMPTS`           | `otp.maxAttempts`       | `5`      | |
| `OTP_MAX_SENDS_PER_HOUR`     | `otp.maxSendsPerHour`   | `5`      | |
| `OTP_HASH_SECRET`            | `otp.hashSecret`        | —        | |
| —                            | `otp.codeLength` / `codeAlphabet` / `redisPrefix` | `6` / digits / `otp` | Hard-coded. |

## File storage

| Env var                 | Config key              | Default    |
| ----------------------- | ----------------------- | ---------- |
| `FILE_STORAGE_ADAPTER`  | `files.storage.adapter` | `minio`    |
| `FILE_STORAGE_PATH`     | `files.storage.path`    | `./uploads`|
| `MINIO_URL`             | `minio.url`             | —          |
| `MINIO_PORT`            | `minio.port`            | `9000`     |
| `MINIO_SECURE`          | `minio.secure`          | `false`    |
| `MINIO_ACCESS_KEY`      | `minio.accessKey`       | —          |
| `MINIO_SECRET_KEY`      | `minio.secretKey`       | —          |
| `MINIO_PRIVATE_BUCKET`  | `minio.buckets.private` | —          |
| `MINIO_PUBLIC_BUCKET`   | `minio.buckets.public`  | —          |
| `MINIO_STAGING_BUCKET`  | `minio.buckets.staging` | —          |

> These keys are still produced, but nothing in the package reads them: the
> `file-storage` subpath export was removed in 0.7.0 and its source deleted in
> 0.8.0. They are kept because services built on the toolkit may already read
> them for their own storage wiring. The `minio` peer dependency is gone.

## ngrok (development)

| Env var         | Config key      | Default | Consumed by |
| --------------- | --------------- | ------- | ----------- |
| `NGROK_ENABLED` | `ngrok.enabled` | `false` | you, to compute `SetupNgrokProxyModule.setup({ enabled })` |
| `NGROK_TOKEN`   | `ngrok.token`   | —       | `SetupNgrokProxyModule` (required when enabled) |
| `NGROK_DOMAIN`  | `ngrok.domain`  | —       | optional reserved domain |

## Keys you must supply yourself

Two namespaces are **read by the package but never produced by its config
factory**. Add them through your own `ConfigModule.forRoot({ load: [...] })`:

| Key                       | Read by                | Notes |
| ------------------------- | ---------------------- | ----- |
| `swagger.title`           | `registerSwagger`      | Required when enabled — throws otherwise. |
| `swagger.version`         | `registerSwagger`      | Required when enabled. |
| `swagger.description`     | `registerSwagger`      | Defaults to `""`. |
| `swagger.server`          | `registerSwagger`      | Defaults to `"/"`. |
| `swagger.outputPath`      | `registerSwagger`      | Defaults to `"./swagger.json"`. |
| `persistence.orm`         | `buildPersistenceConfig` | Defaults to `"prisma"`. |
| `persistence.runMigrations` | `buildPersistenceConfig` | Defaults to `false`. |
| `persistence.ormOptions`  | `buildPersistenceConfig` | |

```ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [() => ({
    swagger: {
      enabled: process.env.SWAGGER_ENABLED === "true",
      title: process.env.SWAGGER_TITLE,
      version: process.env.SWAGGER_VERSION,
    },
    persistence: { orm: process.env.ORM_TYPE ?? "prisma" },
  })],
})
```

## Sample `.env`

```dotenv
NODE_ENV=development
APP_NAME=orders-api
HTTP_PORT=3001
HTTP_GLOBAL_PREFIX=api

DATABASE_URL=postgresql://user:pass@localhost:5432/orders
REDIS_URL=redis://localhost:6379

OBSERVABILITY_LOGGING=winston
OBSERVABILITY_TRACING=noop
OBSERVABILITY_METRICS=prometheus
LOG_LEVEL=debug
LOG_DISPLAY_CONSOLE=true

JWT_SECRET=change-me-at-least-16-chars
SESSION_SECRET=change-me-at-least-16-chars
KMS_PROVIDER=local
```

See [`examples/mini-app/.env.example`](../examples/mini-app/.env.example) for a
working minimal set.
