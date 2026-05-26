# ADR 0003 — Config is Joi-validated; secrets have **no** literal defaults

**Status:** Accepted &nbsp;·&nbsp; **Date:** 2026-05 &nbsp;·&nbsp; **Stability:** Stable

## Context

The earlier `configuration.ts` had patterns like:

```ts
secret: process.env.JWT_SECRET! || "secret",
iosServiceSecret: process.env.IOS_SERVICE_SECRET || "KbQ27jNR1qTCEYRwFLe4Pzh6rUdK0Mvu",
```

The `||` fallback completely bypasses the `!` assertion. If `JWT_SECRET` is unset, the JWT library happily signs and verifies tokens using the literal string `"secret"`. The `IOS_SERVICE_SECRET` case is worse: a real-looking secret value was baked into the published artifact.

Separately, a Joi validation schema existed in `config/configuration.validation.ts` but was commented out in `ConfigModule.forRoot()`.

## Decision

1. **No literal-default secrets.** Any env var whose name contains `SECRET`, `PASSWORD`, `KEY`, `TOKEN`, or that would be used to sign / encrypt / authenticate stays `undefined` when not set. Downstream code that uses it (jsonwebtoken, argon2, etc.) will throw at first use — that's the correct failure mode.
2. **Joi validation is always on.** `ConfigModule.forRoot({ validationSchema, validationOptions: { allowUnknown: true, abortEarly: false } })`. Unknown vars are allowed so consumers can extend the schema; known vars are shape-checked at boot.
3. **No MDC-specific defaults.** App name, super-admin email, keycloak URLs, bucket names, mail providers — all come from env, all default to `undefined` or to a neutral value (`app`, `localhost`, etc.).

## Consequences

- Services that forget to set a required env var **fail loudly at first use**, not silently with a known-weak credential.
- The package is publishable as a standalone npm module — no consumer's secrets get embedded in the artifact.
- Consumers who want stricter validation (e.g. mark certain vars `.required()`) extend the schema and re-pass it to `ConfigModule.forRoot()`.
