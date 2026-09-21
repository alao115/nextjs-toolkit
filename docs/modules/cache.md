# `cache`

```ts
import {
  CacheStoreModule,
  CacheStoreService,
  CUSTOM_REDIS_CLIENT,
  CACHE_STORE_OPTIONS,
  type CacheStoreOptions,
} from "@alaska115/nextjs-toolkit/cache";
```

Redis-backed caching: a `@nestjs/cache-manager` store over Keyv/Redis, plus a
raw `ioredis` client for everything cache-manager doesn't cover (Lua scripts,
pub/sub, sorted sets — what [`rate-limit`](./rate-limit.md) and
[`resilience`](./resilience.md) need).

## Setup

```ts
import { ConfigService } from "@nestjs/config";

CacheStoreModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redisUrl: config.get<string>("redis.url")!,
  }),
})
```

`CacheStoreModule` is `@Global()`. `forRootAsync({ imports?, inject?, useFactory })`
registers `CacheModule.registerAsync()` with a `KeyvRedis` store and exports:

| Token                 | What you get                                        |
| --------------------- | --------------------------------------------------- |
| `CacheStoreService`   | Wrapper exposing the cache-manager `Cache`.         |
| `CUSTOM_REDIS_CLIENT` | A raw `ioredis` `Redis` instance on the same URL.   |
| `CACHE_STORE_OPTIONS` | The resolved `{ redisUrl }` object.                 |

## Usage

```ts
@Injectable()
export class ProductService {
  constructor(
    private readonly cacheStore: CacheStoreService,
    @Inject(CUSTOM_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async get(id: string) {
    const cache = this.cacheStore.storeInstance;      // cache-manager Cache
    const hit = await cache.get<Product>(`product:${id}`);
    if (hit) return hit;

    const fresh = await this.repo.findById(id);
    await cache.set(`product:${id}`, fresh, 60_000);  // ttl in ms
    return fresh;
  }

  async rank(id: string) {
    return this.redis.zincrby("product:views", 1, id); // raw ioredis
  }
}
```

## Notes

- Two connections are opened per process: one via Keyv for the cache-manager
  store, one `ioredis` client for `CUSTOM_REDIS_CLIENT`. That is deliberate —
  the two client libraries have incompatible APIs.
- Neither client is registered with [`ShutdownManager`](./shutdown.md). If you
  need a clean disconnect on SIGTERM, register a hook yourself:

  ```ts
  shutdownManager.registerHook({
    name: "redis-cache",
    phase: "infra",
    shutdown: async () => { await this.redis.quit(); },
  });
  ```
- For multi-tenant deployments, namespace keys with
  [`TenantService.cacheKey()`](./multi-tenancy.md) so one tenant can never read
  another's entries.
