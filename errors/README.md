# `@alaska115/nextjs-toolkit/errors`

Canonical error model + a global `HttpExceptionFilter` that turns every thrown exception into a consistent JSON response with `correlationId`.

## What you get

```ts
{ status: 404, code: "NOT_FOUND", message: "User not found", details: null, correlationId: "..." }
```

The mapping from HTTP status → `code` (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`) is canonical and cannot be overridden via metadata — that's the point. Clients should branch on `code`, not on `message`.

## Wire it up

```ts
import { HttpExceptionFilter } from "@alaska115/nextjs-toolkit/errors";
import { APP_FILTER } from "@nestjs/core";

@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

If you import `ObservabilityModule.forRoot()`, the filter is registered for you.

## Throw a domain exception

`BaseException` carries its own `code`, `httpStatus`, and `details` — the filter preserves them.

```ts
import { BaseException } from "@alaska115/nextjs-toolkit/errors";

export class EmailTakenException extends BaseException {
  constructor(email: string) {
    super(
      `Email ${email} is already in use`,
      "EMAIL_TAKEN",
      409,
      { email },
    );
  }
}

// In a service:
throw new EmailTakenException(input.email);
// → 409 { code: "EMAIL_TAKEN", message: "...", details: { email: "..." }, correlationId }
```

## Domain error helper

```ts
import { DomainError } from "@alaska115/nextjs-toolkit/errors";

throw new DomainError("RATE_LIMITED", "Too many attempts", 429);
```

Use when you want a one-off domain error without defining a subclass.

## What the filter does for you

- **HTTP status → `code` mapping** (no more snake-casing exception messages).
- **Auto-attached `correlationId`** from the `RequestContext`.
- **PII redaction on logged request headers** (`Authorization`, `Cookie`, etc.) before they go to the logger.
- **Sentry / error tracking forwarding** via the `ErrorTrackingService`.
- **No `console.error` spam** — only structured logging.

## Anti-patterns

- **Don't return error objects from controllers.** Throw — let the filter shape the response.
- **Don't put raw user input in `message`** unless it's already validated. The message goes to clients; sanitize first.
- **Don't add a custom error filter that swallows everything.** This filter is `@Catch()` (catches anything) — adding another `@Catch()` filter creates undefined precedence.
