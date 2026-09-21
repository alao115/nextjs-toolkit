# `rate-limit`

> **Experimental** — the API may change before 1.0. The in-memory adapters are
> single-process only; multi-instance deployments need the Redis adapter.

```ts
import {
  RateLimitModule, RateLimitGuard, RateLimit,
  InMemoryRateLimitAdapter, SlidingWindowRateLimitAdapter, RedisRateLimitAdapter,
  RATE_LIMIT_PORT,
  type RateLimitContract, type RateLimitDecision, type RateLimitMetadata,
  type RateLimitModuleOptions, type InMemoryRateLimitConfig,
  type SlidingWindowConfig, type RedisRateLimitConfig,
} from "@alaska115/nextjs-toolkit/rate-limit";
```

## Setup

```ts
import { APP_GUARD } from "@nestjs/core";
import Redis from "ioredis";

@Module({
  imports: [
    RateLimitModule.forRoot({
      adapter: new RedisRateLimitAdapter({
        client: new Redis(process.env.REDIS_URL!),
        max: 100,
        windowMs: 60_000,
        keyPrefix: "rl",
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
```

`forRoot({ adapter?, inMemory? })` binds `RATE_LIMIT_PORT`. With no options it
falls back to `new InMemoryRateLimitAdapter({ max: 60, windowMs: 60_000 })`.
`adapter` takes an **instance**.

The module exports only `RATE_LIMIT_PORT` — `RateLimitGuard` is a class you
register yourself, globally via `APP_GUARD` or per-controller with
`@UseGuards(RateLimitGuard)`.

## Per-route configuration

```ts
@RateLimit({ cost: 5 })
@Post("/reports/generate")
generate() { /* ... */ }

@RateLimit({ skip: true })
@Get("/ping")
ping() { /* ... */ }

@RateLimit({ key: (req) => `otp:${req.body.phone}` })
@Post("/otp/send")
sendOtp() { /* ... */ }
```

| Field  | Type                                 | Default                                          |
| ------ | ------------------------------------ | ------------------------------------------------ |
| `cost` | `number`                             | `1` — deduct more for expensive endpoints.       |
| `key`  | `string \| ((req: Request) => string)` | `` `${tenantId ?? "global"}:${userId ?? ip}:${route}` `` |
| `skip` | `boolean`                            | `false` — exempt one handler under a class guard. |

Method metadata wins over class metadata.

## Response headers and rejection

The guard sets `X-RateLimit-Remaining` on every request. When the bucket is
empty it sets `Retry-After` (seconds, rounded up from `retryAfterMs`) and throws
an `HttpException` with `429 Too Many Requests`.

There is no `X-RateLimit-Limit` or `X-RateLimit-Reset` header today.

## Adapters

| Adapter                         | Algorithm                          | Scope             |
| ------------------------------- | ---------------------------------- | ----------------- |
| `InMemoryRateLimitAdapter`      | Fixed window                       | One process       |
| `SlidingWindowRateLimitAdapter` | Sliding log — smoother at boundaries, more memory | One process |
| `RedisRateLimitAdapter`         | Atomic Lua script                  | Whole cluster     |

All three implement:

```ts
consume(key: string, cost = 1): Promise<RateLimitDecision>
// RateLimitDecision = { allowed: boolean; remaining: number; retryAfterMs?: number }
```

Neither in-memory adapter prunes its map, so a high-cardinality key function
(per-user, per-route) grows memory for the lifetime of the process. Keep the key
space bounded, or use Redis.

The fixed-window adapter lets a caller burst up to `2 × max` across a window
boundary. Use the sliding-window one if that matters and you're single-process;
use Redis as soon as you run more than one instance — two pods with in-memory
limiters give each caller double the intended quota.

## Multi-tenant keys

Compose with [`TenantService.rateLimitKey()`](./multi-tenancy.md) so one noisy
tenant can't consume another's budget:

```ts
@RateLimit({ key: (req) => tenantService.rateLimitKey(req.user.id, req.route.path) })
```

See [`examples/04-rate-limit.ts`](../../examples/04-rate-limit.ts).
