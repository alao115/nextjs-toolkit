# `@alaska115/nextjs-toolkit/outbox`

Transactional outbox pattern. Use this whenever a database write should reliably cause a downstream side effect (publish a Kafka message, send an email, call a webhook, emit an audit event).

## Why

If you do:

```ts
await prisma.user.create({ data });
await kafka.publish({ event: "user.created", data });
```

…and Kafka is briefly unavailable, you have a user in the database that nobody downstream knows about. Reversing the order has the symmetric problem.

The outbox pattern persists the event **in the same transaction as the business write**, then a separate worker drains pending records to the destination with at-least-once delivery semantics.

## Wire it up

```ts
import { OutboxModule, OutboxWorker, PrismaOutboxAdapter } from "@alaska115/nextjs-toolkit/outbox";

const outbox = new PrismaOutboxAdapter({ prisma, modelName: "outboxEvent" });

@Module({
  imports: [OutboxModule.forRoot({ adapter: outbox })],
  providers: [OutboxWorker],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly worker: OutboxWorker) {}

  onModuleInit() {
    this.worker.configure({
      subscribers: {
        "user.created": async (record) => kafka.publish(record.payload),
        "*": async (record) => console.warn("no handler for", record.type),
      },
      maxAttempts: 10,
      pollIntervalMs: 1000,
      deadLetterHandler: async (record) => {
        await deadLetterStore.save(record);
      },
    });
    this.worker.start();
  }
}
```

`PrismaOutboxAdapter` requires a Prisma model with this shape:

```prisma
model OutboxEvent {
  id           String   @id @default(uuid())
  type         String
  payload      Json
  createdAt    DateTime @default(now())
  publishedAt  DateTime?
  attempts     Int      @default(0)
  lastError    String?
  claimedAt    DateTime?
  correlationRequestId      String?
  correlationCorrelationId  String?
  correlationTraceId        String?
  correlationTenantId       String?
  @@index([publishedAt, claimedAt])
}
```

## Enqueue

```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data });
  await outbox.enqueue({ type: "user.created", payload: { id: user.id } });
});
```

The enqueue happens **inside the same transaction** as the business write — that's the whole point. If the transaction rolls back, no outbox row is created.

## Behavior

- `claimPending(n)` is atomic across workers (uses a transaction + `claimedAt` lock).
- Stale claims (handler crashed mid-dispatch) are reclaimed after `staleClaimAfterMs` (default 5 minutes).
- `OutboxWorker` registers a shutdown hook so an in-flight batch finishes before the process exits.
- After `maxAttempts` failed deliveries, the record is passed to `deadLetterHandler` (default: logged and dropped — override for real DLQ).

## Anti-patterns

- **Don't enqueue outside a transaction.** That defeats the entire pattern.
- **Don't start a worker per HTTP instance.** One dedicated worker process (or a cluster leader) avoids contention. The `staleClaimAfterMs` mechanism makes "two workers race" safe but not free.
- **Don't rely on event ordering across types.** Records are claimed in insertion order, but parallel dispatch means subscribers can see two events of different types in any interleaving.
