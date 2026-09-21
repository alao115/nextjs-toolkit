# `outbox`

> **Experimental** — the API may change before 1.0. The in-memory adapter is
> **not** production-ready; use a persistent backend (a Postgres outbox table is
> the canonical choice).

```ts
import {
  OutboxModule, OutboxWorker,
  PrismaOutboxAdapter, InMemoryOutboxAdapter,
  OUTBOX_PORT,
  type OutboxContract, type OutboxRecord, type OutboxModuleOptions,
  type OutboxWorkerConfig, type OutboxSubscriber, type PrismaOutboxConfig,
} from "@alaska115/nextjs-toolkit/outbox";
```

The transactional outbox pattern: write the event to the same database
transaction as the state change, then publish it asynchronously. That is what
makes "the order was saved but the event was lost" impossible.

## Setup

```ts
OutboxModule.forRoot({
  adapter: new PrismaOutboxAdapter({ prisma, modelName: "outboxEvent" }),
})
```

`forRoot({ adapter? })` binds and exports `OUTBOX_PORT`. Without an adapter you
get `InMemoryOutboxAdapter` — fine for tests, useless across a restart.

`OutboxWorker` is **not** provided by the module; register it yourself so you
can decide which process runs it.

## Enqueuing

Inside the same transaction as your write:

```ts
await this.uow.withTransaction(async (tx) => {
  const order = await tx.get<OrderRepo>(ORDER_REPO).create(dto);
  await this.outbox.enqueue({
    type: "order.created",
    payload: { orderId: order.id, total: order.total },
    correlation: {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
      tenantId: ctx.tenantId,
    },
  });
});
```

`OutboxContract`:

```ts
enqueue(record: Omit<OutboxRecord, "id" | "createdAt" | "attempts">): Promise<OutboxRecord>
claimPending(limit: number): Promise<OutboxRecord[]>
markPublished(id: string): Promise<void>
markFailed(id: string, error: string): Promise<void>
```

Carry the correlation ids through — otherwise the trace dies at the transaction
boundary and you can't connect the published event back to the request.

## The worker

```ts
@Injectable()
export class OutboxBootstrap implements OnModuleInit {
  constructor(private readonly worker: OutboxWorker) {}

  onModuleInit() {
    this.worker.configure({
      pollIntervalMs: 1_000,
      busyPollIntervalMs: 50,
      batchSize: 50,
      maxAttempts: 5,
      subscribers: {
        "order.created": async (record) => { await kafka.send(record); },
        "*": async (record) => { await kafka.send(record); },  // catch-all
      },
      deadLetterHandler: async (record) => { await dlq.send(record); },
    })
    .start();   // configure() alone does NOT start the loop
  }
}
```

| Option               | Default | Meaning                                                    |
| -------------------- | ------- | ---------------------------------------------------------- |
| `pollIntervalMs`     | `1000`  | Sleep when the last batch was empty.                       |
| `busyPollIntervalMs` | `50`    | Sleep when the last batch had work — drains backlogs fast. |
| `batchSize`          | `50`    | Records claimed per poll.                                  |
| `maxAttempts`        | `10`    | After this many attempts, the record goes to the dead-letter handler. |
| `subscribers`        | required| `type` → `(record) => Promise<void>`. `"*"` is the catch-all. |
| `deadLetterHandler`  | logs + drops | Called for poison records instead of retrying forever. |

`configure()` returns `this`, so it chains into `start()`.

> `onModuleInit` only registers the shutdown hook — it does **not** start
> polling. Call `start()` explicitly. `stop()` requests a stop (the current
> batch finishes) and `isRunning()` reports the loop state.

A record whose `type` matches no subscriber and no `"*"` entry is marked
**failed** with `No subscriber registered for type "…"`, and burns an attempt
each poll until it hits `maxAttempts`. Register a catch-all if you publish types
the worker doesn't know about yet.

Records in a batch are dispatched concurrently (`Promise.all`), so subscribers
must tolerate parallel invocation.

## `PrismaOutboxAdapter`

```ts
new PrismaOutboxAdapter({ prisma, modelName: "outboxEvent", staleClaimAfterMs: 60_000 })
```

`modelName` defaults to `"outboxEvent"`. `staleClaimAfterMs` re-claims records
whose worker died mid-publish.

The model needs at minimum: `id`, `type`, `payload` (Json), `createdAt`,
`publishedAt` (nullable), `attempts`, `lastError` (nullable), `correlation`
(Json, nullable), plus whatever claim column the adapter uses — read
[`prisma-outbox.adapter.ts`](../../outbox/prisma-outbox.adapter.ts) for the
exact field names before writing your migration.

## Delivery semantics

At-least-once. A publish can succeed and the `markPublished` that follows can
fail, so the same event may be delivered twice. **Consumers must be
idempotent** — deduplicate on `record.id`.

See [`examples/03-outbox-worker.ts`](../../examples/03-outbox-worker.ts).
