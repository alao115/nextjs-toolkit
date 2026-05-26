# `@alaska115/nextjs-toolkit/cache`

A thin wrapper over [`@nestjs/cache-manager`](https://docs.nestjs.com/techniques/caching) configured with a Redis backend (`@keyv/redis`) plus a raw `ioredis` client exposed via `CUSTOM_REDIS_CLIENT` for advanced use cases (pub/sub, Lua scripts, sorted sets).

## Wire it up

```ts
import { CacheStoreModule, CACHE_STORE_OPTIONS } from "@alaska115/nextjs-toolkit/cache";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    CacheStoreModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redisUrl: config.get<string>("redis.url")!,
      }),
    }),
  ],
})
export class AppModule {}
```

## Use it

```ts
import { CacheStoreService } from "@alaska115/nextjs-toolkit/cache";
import { CUSTOM_REDIS_CLIENT } from "@alaska115/nextjs-toolkit/cache";
import Redis from "ioredis";

@Injectable()
export class UserService {
  constructor(
    private readonly cache: CacheStoreService,
    @Inject(CUSTOM_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getUser(id: string) {
    const cached = await this.cache.storeInstance.get<User>(`user:${id}`);
    if (cached) return cached;
    const user = await this.db.findUser(id);
    await this.cache.storeInstance.set(`user:${id}`, user, 60_000); // ms
    return user;
  }

  // Use `redis` directly for non-key/value ops:
  async incrementViews(id: string) {
    return this.redis.incr(`views:${id}`);
  }
}
```

## Tenant-scoped keys

Pair with `TenantService` from `multi-tenancy` to enforce per-tenant cache isolation:

```ts
const key = this.tenant.cacheKey("user", id); // "t:acme:user:42"
await this.cache.storeInstance.set(key, user);
```

## Anti-patterns

- **Don't cache user-controlled keys without sanitization.** Cache poisoning is the OWASP-listed flavor of "log injection but worse."
- **Don't cache without a TTL.** Stale-forever entries silently mask correctness bugs and leak memory.
- **Don't share Redis instances across staging and prod.** A `FLUSHDB` for testing wipes both.
- **Don't use `CacheStoreService` for distributed locks.** Use `ioredis` directly with `SET NX PX` + a dedicated wrapper (e.g. [redlock](https://github.com/mike-marcacci/node-redlock)).
