# `errors`

```ts
import {
  BaseException,
  HttpExceptionFilter,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidTokenError,
  InvalidRefreshTokenError,
  AuthLockoutError,
  type ErrorCode,
  type LogicalErrorCode,
  type CanonicalError,
  type DomainErrorCode,
  type ThrownErrorCallback,
} from "@alaska115/nextjs-toolkit/errors";
```

A single exception base class plus a global filter that turns anything thrown
into one canonical JSON body.

## `BaseException`

```ts
new BaseException(message, code, httpStatus?, details?, retryable = false)
```

| Property     | Type      | Notes                                                    |
| ------------ | --------- | -------------------------------------------------------- |
| `code`       | `string`  | Stable machine-readable code — what clients switch on.   |
| `httpStatus` | `number?` | Falls back to 500 in the filter when unset.              |
| `details`    | `any?`    | Serialized into the response as-is; keep it PII-free.    |
| `retryable`  | `boolean` | Advisory flag for callers; the filter does not read it.  |

Subclass it for your own domain errors:

```ts
export class WidgetNotFoundError extends BaseException {
  constructor(id: string) {
    super(`Widget '${id}' not found`, "WIDGET_NOT_FOUND", 404, { id });
  }
}
```

## Built-in domain errors

| Class                      | Code                     | Status |
| -------------------------- | ------------------------ | ------ |
| `EmailTakenError(email)`   | `EMAIL_TAKEN`            | 400    |
| `InvalidCredentialsError`  | `INVALID_CREDENTIALS`    | 401    |
| `InvalidTokenError`        | `INVALID_TOKEN`          | 401    |
| `InvalidRefreshTokenError` | `INVALID_REFRESH_TOKEN`  | 401    |
| `AuthLockoutError`         | `AUTH_LOCKOUT`           | 403    |

## `HttpExceptionFilter`

```ts
import { APP_FILTER } from "@nestjs/core";

providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }]
```

`@Catch()` with no argument — it handles *everything*. Response body:

```json
{
  "status": 404,
  "code": "WIDGET_NOT_FOUND",
  "message": "Widget 'abc' not found",
  "details": { "id": "abc" },
  "correlationId": "…"
}
```

Resolution rules:

| Thrown value               | `status`                | `code`                              |
| -------------------------- | ----------------------- | ----------------------------------- |
| `BaseException`            | `httpStatus ?? 500`     | `exception.code`                    |
| `HttpException` (Nest)     | `exception.getStatus()` | mapped from the status (below)      |
| anything else              | `500`                   | `INTERNAL_ERROR`                    |

Status → `LogicalErrorCode` mapping: 400/422 → `VALIDATION_ERROR`,
401 → `UNAUTHENTICATED`, 403 → `UNAUTHORIZED`, 404 → `NOT_FOUND`,
409 → `CONFLICT`, 503 → `SERVICE_UNAVAILABLE`, everything else →
`INTERNAL_ERROR`.

`correlationId` is the `x-kong-request-id` header, else `x-request-id`, else the
request-context `requestId`, else a fresh UUID.

Side effects on every caught exception: one `logger.error("HttpException", …)`
with **redacted** headers (see [`redact`](./observability.md#redact)), and one
`errorTracking.captureError(…)` — a no-op unless an error tracker is wired.

Its constructor depends on `ErrorTrackingService`, `RequestContextService` and
`LoggerService`, so [`ObservabilityModule`](./observability.md) (or at least
`LoggerModule` + `ErrorTrackingModule`) must be in the tree.

## Not re-exported

`GrpcExceptionFilter` and `SecretKeyNotFoundException` exist in the source tree
but are not part of the `/errors` entrypoint.
