# `@alaska115/nextjs-toolkit/rate-limit`

Pluggable rate limiting with a port/adapter split.

## Adapters

| Adapter                          | Algorithm           | Scope          | When to use |
| -------------------------------- | ------------------- | -------------- | ----------- |
| `InMemoryRateLimitAdapter`       | Fixed window        | Single-process | Tests, single-replica dev |
| `SlidingWindowRateLimitAdapter`  | Sliding window      | Single-process | Single-replica prod that needs no burst-at-edge |
| `RedisRateLimitAdapter`          | Fixed window (Lua)  | Multi-instance | Production, multiple replicas |

`InMemoryRateLimitAdapter` and `SlidingWindowRateLimitAdapter` lose state on restart and don't coordinate across replicas. **Use Redis** for any production deployment with more than one instance.

## Wire it up

```ts
import { RateLimitModule, RedisRateLimitAdapter } from "@alaska115/nextjs-toolkit/rate-limit";

@Module({
  imports: [
    RateLimitModule.forRoot({
      adapter: new RedisRateLimitAdapter({
        client: redis,
        max: 100,
        windowMs: 60_000,
      }),
    }),
  ],
})
export class AppModule {}
```

## Use the HTTP guard

```ts
import { RateLimitGuard, RateLimit } from "@alaska115/nextjs-toolkit/rate-limit";

@UseGuards(RateLimitGuard)
@Controller("/api")
export class ApiController {
  @RateLimit({ cost: 5 })  // this endpoint costs 5x
  @Post("/expensive")
  expensive() { ... }

  @RateLimit({ skip: true }) // exempt
  @Get("/health")
  health() { ... }
}
```

The default key is `${tenantId ?? "global"}:${userId ?? ip}:${route}`, so tenants are isolated, authenticated users are limited per-account, anonymous users per-IP. Override with `@RateLimit({ key: (req) => ... })` for fancy composition.

The guard sets `X-RateLimit-Remaining` on every response and `Retry-After` on 429 responses (RFC 6585 compliant).

## Anti-patterns

- **Don't rate-limit on IP alone behind a CDN/load balancer.** `req.ip` is the LB's IP, not the client. Make sure your LB sets `X-Forwarded-For` and Express trusts the proxy (`app.set("trust proxy", ...)`).
- **Don't use the in-memory adapter for production.** It's a deceptive footgun: it works in dev, then quietly lets 4x the burst through behind a load balancer.
- **Don't tier-limit by user-controlled headers.** If your "premium" tier is keyed off a header the client sends, the client gets the premium tier.
