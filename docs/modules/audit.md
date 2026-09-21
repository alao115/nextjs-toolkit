# `audit`

> **Experimental** — the API may change before 1.0. Pin a minor version if you
> depend on the exact shape.

```ts
import {
  AuditModule, AuditLogService, ActorResolver,
  DefaultAuditLogAdapter, PrismaAuditLogAdapter,
  AUDIT_LOG_PORT,
  computeAuditHash, sealAuditEvent, verifyAuditChain,
  type AuditEvent, type AuditLogContract, type AuditEmitInput,
  type AuditModuleOptions, type PrismaAuditLogConfig, type SealedAuditEvent,
} from "@alaska115/nextjs-toolkit/audit";
```

Structured, append-only audit events with an auto-resolved actor and an optional
tamper-evident hash chain.

## Setup

```ts
AuditModule.forRoot()                                  // logs via DefaultAuditLogAdapter
AuditModule.forRoot({ adapter: MyAuditLogAdapter })    // a Type<AuditLogContract>
```

`forRoot()` provides the adapter, binds it to `AUDIT_LOG_PORT`, and exports
`AuditLogService` and `ActorResolver`. Note that `adapter` is a **class**, not
an instance — it is instantiated by Nest, so it can inject.

## Emitting

```ts
await this.audit.emit({
  action: "user.password.reset",
  outcome: "success",
  resource: { type: "user", id: userId },
  attributes: { via: "email-link" },
});
```

You only supply `action` and `outcome` (plus optional `resource`, `reason`,
`attributes`). `AuditLogService.emit()` fills in the rest from the
[request context](./context.md):

| Field         | Filled with                                                        |
| ------------- | ------------------------------------------------------------------ |
| `timestamp`   | `new Date().toISOString()`                                         |
| `actor`       | `ActorResolver.resolve()` — see below                              |
| `tenantId`    | the context `tenantId`                                             |
| `correlation` | `{ requestId, correlationId, traceId }` from the context           |

Anything you pass explicitly wins. With no adapter bound, `emit()` is a no-op.

`outcome` is `"success" | "failure" | "denied"`. Record denials — an audit log
that only contains successes can't answer "who tried to do this?".

### `ActorResolver`

| Situation                        | Actor                                              |
| -------------------------------- | -------------------------------------------------- |
| Context has `userId`             | `{ id: userId, type: "user", ip }`                 |
| No request context at all        | `{ id: "system", type: "system" }`                 |
| Context, but no user             | `{ id: "anonymous", type: "anonymous", ip }`       |

Pass `actor` explicitly for service-to-service calls
(`{ id: "billing-svc", type: "service" }`).

## Adapters

### `DefaultAuditLogAdapter`

Writes each event through [`LoggerService`](./observability.md). Good enough
when your log pipeline is already the system of record; it is *not* append-only
in any enforceable sense.

### `PrismaAuditLogAdapter`

```ts
new PrismaAuditLogAdapter({ prisma, modelName: "auditEvent", chained: true })
```

Inserts into a Prisma table in sequence order and (by default) seals each row
into a hash chain. `modelName` defaults to `"auditEvent"`, `chained` to `true`.
Sequence and hash are assigned inside a transaction, so concurrent emits can't
link to the same `previousHash`.

Required model:

```prisma
model AuditEvent {
  id           String   @id @default(uuid())
  sequence     BigInt   @unique
  timestamp    DateTime @default(now())
  actorId      String
  actorType    String
  actorIp      String?
  tenantId     String?
  action       String
  resourceType String?
  resourceId   String?
  outcome      String
  reason       String?
  attributes   Json?
  correlation  Json?
  resource     Json?
  previousHash String?
  hash         String?

  @@index([tenantId, timestamp])
  @@index([action, timestamp])
}
```

Grant the application's database role **INSERT only** on this table — no UPDATE,
no DELETE. The adapter can't enforce that; Postgres can.

## Chain verification

```ts
const rows = await prisma.auditEvent.findMany({ orderBy: { sequence: "asc" } });
const broken = verifyAuditChain(rows.map(rowToSealed));
if (broken !== -1) throw new Error(`Audit chain broken at index ${broken}`);
```

| Function                                           | Returns                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| `computeAuditHash(event, previousHash, sequence)`   | SHA-256 over the canonical (key-sorted) serialization. |
| `sealAuditEvent(event, previous \| null)`           | The next `SealedAuditEvent`; genesis `previousHash` is 64 zeros. |
| `verifyAuditChain(events)`                          | Index of the first invalid record, or `-1` if intact. |

Verification checks that `previousHash` links correctly, that `sequence` matches
position, and that the recomputed hash matches the stored one — so any
retroactive edit invalidates every record after it.

> **Hash format changed after 0.7.0.** Up to and including 0.7.0,
> `computeAuditHash` did not actually hash the event's contents (an array
> replacer passed to `JSON.stringify` stripped every nested field), so content
> tampering was undetectable. That is fixed, which means hashes differ from
> those an older version produced. Chains sealed before the fix will not verify
> — and never carried the guarantee they claimed. Archive them and start a new
> chain rather than re-sealing.

The chain proves that the stored rows are internally consistent. It does not
prove nothing was deleted from the *end* — truncating the newest records leaves
a valid shorter chain. Pair it with an external high-water mark (ship
`max(sequence)` somewhere the application role cannot write) if you need
append-only guarantees at the tail.

## Writing your own adapter

```ts
@Injectable()
export class KafkaAuditAdapter implements AuditLogContract {
  async emit(event: AuditEvent) { await this.producer.send({ topic: "audit", ... }); }
}

AuditModule.forRoot({ adapter: KafkaAuditAdapter })
```

See [`examples/02-audit.ts`](../../examples/02-audit.ts).
