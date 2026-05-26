# `@alaska115/nextjs-toolkit/audit`

Tamper-evident audit logging primitives. Use this — not the application logger — for the trails that **legal, compliance, and incident-response teams need to be able to trust**.

## When to use

- "Who changed this user's role?"
- "Did this service ever attempt to delete this record?"
- "What permission decision led to this 403?"

If a question starts with **"who did what, when, and was it allowed"**, it's an audit question.

## Wire it up

```ts
import { AuditModule } from "@alaska115/nextjs-toolkit/audit";

@Module({ imports: [AuditModule.forRoot()] })
export class AppModule {}
```

The default adapter writes events to your application logger tagged `category: "audit"`. For real compliance environments, implement your own `AuditLogContract` (Postgres append-only table, S3 immutable bucket, dedicated SIEM topic) and pass it as `AuditModule.forRoot({ adapter: MyAuditStore })`.

## Emit an event

```ts
constructor(private readonly audit: AuditLogService) {}

async deleteUser(id: string) {
	await this.userService.delete(id);
	await this.audit.emit({
		action: "user.delete",
		resource: { type: "user", id },
		outcome: "success",
	});
}
```

`AuditLogService.emit()` **auto-enriches** with:
- `timestamp` (ISO-8601)
- `actor` — resolved from the current request via `ActorResolver`
- `tenantId` — from `RequestContext`
- `correlation` — `requestId`, `correlationId`, `traceId`

## Tamper-evident chain

```ts
import { sealAuditEvent, verifyAuditChain } from "@alaska115/nextjs-toolkit/audit";

const sealed = sealAuditEvent(event, lastSealedEvent);
// sealed.hash now depends on `lastSealedEvent.hash`.

const brokenIndex = verifyAuditChain(allSealedEventsInOrder);
if (brokenIndex !== -1) {
	throw new Error(`Audit chain tampered at record #${brokenIndex}`);
}
```

A persistent adapter that wants tamper-evidence should fetch the last sealed event, call `sealAuditEvent(newEvent, last)`, and store the result. Any retroactive edit invalidates every record after it.

## Anti-patterns

- **Don't use the application logger as your only audit trail.** Logs get rotated, sampled, and routed through systems that aren't audited themselves.
- **Don't put PII in `action` or `resource.type`.** Those are categorical taxonomies — log the IDs in `resource.id`, names go in `attributes` and pass through `redact()` first if user-controlled.
- **Don't emit audit events inside critical write transactions** unless your adapter participates in the transaction. Otherwise a DB rollback leaves a "ghost" audit record. Use the [`outbox`](../outbox/) pattern for transactional emit.
