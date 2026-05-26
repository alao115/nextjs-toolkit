# ADR 0002 — All DI tokens are `Symbol`s, never strings

**Status:** Accepted &nbsp;·&nbsp; **Date:** 2026-05 &nbsp;·&nbsp; **Stability:** Stable

## Context

Early modules used string DI tokens (`"ORM_HEALTH_CLIENT"`, `"NOTIFICATION_PROVIDERS"`, etc.). This caused at least one shipped bug: in `ObservabilityModule.forRoot()`, three of four interceptors were registered as `provide: "APP_INTERCEPTOR"` (string) where the actual NestJS-recognized token is the `APP_INTERCEPTOR` symbol exported from `@nestjs/core`. Nest treats string and symbol tokens as different keys, so those interceptors silently never fired in production.

## Decision

Every DI token defined inside this package is a `Symbol(...)` exported alongside its contract. Examples:

```ts
export const LOGGING_PORT = Symbol("LOGGING_PORT");
export const ORM_HEALTH_CLIENT = Symbol("ORM_HEALTH_CLIENT");
export const NOTIFICATION_PROVIDERS = Symbol("NOTIFICATION_PROVIDERS");
```

Class tokens (`useClass: PrismaService`) keep using the class identity directly — that's a TypeScript-native form of "symbol" and doesn't collide.

## Consequences

- **Token collisions across packages become impossible.** Two libraries can each declare `Symbol("CACHE")` — they're distinct values, not strings that happen to match.
- **Consumers must import the symbol** to inject (`@Inject(LOGGING_PORT)`). The package re-exports every symbol from its module's barrel so a single `from "@alaska115/nextjs-toolkit/logger"` import suffices.
- **The class of bug that surfaced during the `ObservabilityModule` refactor — silently mis-registered providers — is now ruled out by the type system at the call site.**
