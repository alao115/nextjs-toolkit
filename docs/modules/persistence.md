# `persistence`

```ts
import {
  PersistenceModule,
  buildPersistenceConfig,
  PERSISTENCE_ADAPTER, UNIT_OF_WORK, TRANSACTION_CONTEXT,
  PRISMA_CLIENT, PRISMA_OPTIONS,
  PrismaService, PrismaHealthService, PrismaUnitOfWork,
  PrismaPersistenceAdapter, PrismaTransactionContext, PrismaTransactionRepoFactory,
  InMemoryUnitOfWork, InMemoryPersistenceAdapter,
  type OrmType, type AppPersistenceConfig, type PersistencePort,
  type PersistenceHealthService, type FindOptions, type IGenericRepository,
  type UnitOfWorkPort, type TransactionContext, type TransactionMetadata,
} from "@alaska115/nextjs-toolkit/persistence";
```

An ORM-agnostic persistence port with a Prisma adapter and an in-memory stub,
plus an `AsyncLocalStorage`-backed unit of work.

## Setup

```ts
import { PrismaClient } from "@prisma/client"; // your generated client

PersistenceModule.register({
  orm: "prisma",
  url: process.env.DATABASE_URL,
  ormClient: PrismaClient,
})
```

`PersistenceModule` is `@Global()`. `register()` binds, per `orm`:

| `orm`                 | `PERSISTENCE_ADAPTER`        | `UNIT_OF_WORK`      | Also exported  |
| --------------------- | ---------------------------- | ------------------- | -------------- |
| `"prisma"`            | `PrismaPersistenceAdapter`   | `PrismaUnitOfWork`  | `PrismaService` |
| `"inmemory"` (default)| `InMemoryPersistenceAdapter` | `InMemoryUnitOfWork`| —              |

`TransactionContextStore` is always provided.

### `AppPersistenceConfig`

| Field               | Type                        | Notes                                                |
| ------------------- | --------------------------- | ---------------------------------------------------- |
| `orm`               | `"prisma" \| "inmemory"`    | Required.                                            |
| `url`               | `string?`                   | Connection string.                                   |
| `ormClient`         | `any?`                      | Your generated `PrismaClient` **class**.             |
| `driverFactory`     | `(url?) => any`             | Builds the Prisma driver adapter. Defaults to `new PrismaPg({ connectionString: url })` from the optional `@prisma/adapter-pg` peer dep. |
| `ormOptions`        | `Record<string, any>?`      | Free-form; stored on the config, not forwarded to the client today. |
| `logQueries`        | `boolean?`                  | Log every SQL statement at `info`. Default `false`.  |
| `runMigrations`     | `boolean?`                  | Advisory flag.                                       |
| `enableHealthCheck` | `boolean?`                  | Advisory flag.                                       |

### `buildPersistenceConfig(configService)`

Builds an `AppPersistenceConfig` from `ConfigService`, reading
`persistence.orm` (default `"prisma"`), `db.url`, `persistence.runMigrations`
and `persistence.ormOptions`.

> The package's own config factory produces `db.*` but **not** `persistence.*`.
> Either add a `persistence` namespace in your own `ConfigModule.forRoot({ load })`
> or skip this helper and hand-build the config object.

## `PersistencePort`

Injected with `@Inject(PERSISTENCE_ADAPTER)`. A thin, ORM-neutral CRUD surface —
use it for generic code (audit, tooling, shared repositories); drop to
`PrismaService` when you want the full typed Prisma API.

```ts
findOne<T>(options: FindOptions): Promise<T | null>
findMany<T>(options: FindOptions): Promise<T[]>
insert<T>({ entity, data }): Promise<T>
update<T>({ entity, data }): Promise<T>
delete({ entity, where }): Promise<void>
transactional<T>(fn: (ctx?) => Promise<T>): Promise<T>
get getOrm: any     // the underlying client (throws on the in-memory adapter)
```

`FindOptions`: `{ entity, where?, select?, include?, orderBy?, limit?, offset? }`.

## `PrismaService`

```ts
@Injectable()
export class OrderRepo {
  constructor(private readonly prisma: PrismaService) {}
  find(id: string) {
    return this.prisma.instance.order.findUnique({ where: { id } });
  }
}
```

- `instance` — your real Prisma client, constructed as
  `new ormClient({ adapter })`. Its declared type is a loose shim
  (`$queryRaw`, `$transaction`, `$connect`, `$disconnect`, `$on`), so cast to
  your generated client type when you want full model typing:
  `(this.prisma.instance as unknown as PrismaClient).order.findMany(...)`.
- `isDBClientInitialized` — whether `onModuleInit` completed.
- Connects on `onModuleInit`, disconnects on `onModuleDestroy`, and registers an
  `infra`-phase hook with [`ShutdownManager`](./shutdown.md).
- Logs every SQL statement at `info` **only when `logQueries: true`** is set on
  the persistence config. It is off by default because query text routinely
  carries personal data and credentials in literals.

## Unit of work

```ts
@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort;

await this.uow.withTransaction(async (tx) => {
  const repo = tx.get<OrderRepo>(ORDER_REPO);   // transaction-scoped repository
  await repo.create(order);
  await this.outbox.enqueue({ type: "order.created", payload });
});
```

| Method                   | Behaviour                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| `withTransaction(fn)`    | Opens a transaction, stores the context in ALS, runs `fn`.       |
| `isInTransaction()`      | Whether a transaction is active on this async branch.            |
| `getCurrentTransaction()`| The active `TransactionContext`, or `null`.                      |

`TransactionContext` exposes `metadata` (`{ id, orm, … }`) and
`get<T>(token: symbol)` for transaction-scoped repositories. Register those by
subclassing `PrismaTransactionRepoFactory` and returning a
`Record<symbol, unknown>` from `createRepos(txClient)`.

Because the context lives in `AsyncLocalStorage`, nested service calls see the
same transaction without threading a `tx` argument through every signature.

## In-memory adapter

`InMemoryPersistenceAdapter` is a **stub**, not a working store: every CRUD
method is a no-op or returns `null`/`[]`, and `getOrm` throws. It exists so an
app can boot (and health checks can pass) without a database. `InMemoryUnitOfWork`
does run the callback, so transaction-shaped code paths still execute.

Use `orm: "inmemory"` for smoke tests and examples; do not mistake it for a test
double with storage.

## `IGenericRepository<T>`

An optional repository interface (`findById`, `findOne`, `findMany`,
`totalCount?`, `create`, `update`, `delete`, `toDomain`) you can implement to
keep repositories uniform. Nothing in the package requires it.
