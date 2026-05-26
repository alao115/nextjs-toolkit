# `@alaska115/nextjs-toolkit/persistence`

A `PersistencePort` abstraction with two adapters: `PrismaPersistenceAdapter` (production) and `InMemoryPersistenceAdapter` (stub that throws "not implemented" — override for tests). Includes a Unit-of-Work with `AsyncLocalStorage` transaction propagation so repositories see the current transaction automatically.

## Wire it up

```ts
import { PersistenceModule } from "@alaska115/nextjs-toolkit/persistence";
import { PrismaClient } from "@prisma/client";

@Module({
  imports: [
    PersistenceModule.register({
      orm: "prisma",
      url: process.env.DATABASE_URL,
      ormClient: PrismaClient,
      // optional: select a non-Postgres driver
      driverFactory: (url) => new PrismaMySqlDriver({ connectionString: url }),
    }),
  ],
})
export class AppModule {}
```

If `orm: "inmemory"`, none of the Prisma deps load — `@prisma/client` and `@prisma/adapter-pg` are lazy-required only inside `PrismaService.onModuleInit`.

## Use the Unit of Work

```ts
import { UNIT_OF_WORK, UnitOfWorkPort } from "@alaska115/nextjs-toolkit/persistence";

@Injectable()
export class OrderService {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort) {}

  async placeOrder(input: OrderInput) {
    return this.uow.withTransaction(async (tx) => {
      const order = await tx.get<OrderRepository>(ORDER_REPOSITORY).create(input);
      await tx.get<OutboxRepository>(OUTBOX_REPOSITORY).enqueue({
        type: "order.placed",
        payload: { orderId: order.id },
      });
      return order;
    });
  }
}
```

Nested `withTransaction` calls **reuse the existing transaction** — the inner block sees the same `tx` so a partial failure aborts the whole tree. This is the standard pattern; the package handles it via `TransactionContextStore` (an ALS-based store).

## Direct Prisma access

```ts
constructor(private readonly prisma: PrismaService) {}

async ping() {
  return this.prisma.instance.$queryRaw`SELECT 1`;
}
```

Direct access is fine for read-side or one-off queries. For multi-step writes, use the Unit of Work so the transaction propagates.

## Health

`PrismaHealthService` is auto-bound to `HealthModule.forRoot({ orm: "prisma" })` — it issues a `SELECT 1` and reports latency.

## Anti-patterns

- **Don't pass `tx` through method signatures.** That's what `AsyncLocalStorage` is for. Repositories should call `this.store.getCurrentTransaction()` and use it if present, fall back to the client.
- **Don't share `PrismaClient` instances across orm modes.** Re-create on each `PersistenceModule.register()`.
- **Don't `await prisma.$disconnect()` manually.** The `ShutdownManager` hook does it; calling it yourself races the framework teardown.
- **Don't define repository tokens here.** `USER_REPOSITORY` etc. are domain concerns — put them in your service's module.
