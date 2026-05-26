import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OutboxContract, OutboxRecord } from "./outbox.contract";

/**
 * In-memory outbox — suitable for tests and single-process dev. Loses
 * everything on restart. Production deployments MUST use a persistent
 * adapter (Postgres outbox table is the canonical implementation).
 */
@Injectable()
export class InMemoryOutboxAdapter implements OutboxContract {
	private readonly records = new Map<string, OutboxRecord>();
	private readonly inFlight = new Set<string>();

	async enqueue(
		input: Omit<OutboxRecord, "id" | "createdAt" | "attempts">,
	): Promise<OutboxRecord> {
		const record: OutboxRecord = {
			id: randomUUID(),
			createdAt: new Date(),
			attempts: 0,
			...input,
		};
		this.records.set(record.id, record);
		return record;
	}

	async claimPending(limit: number): Promise<OutboxRecord[]> {
		const claimed: OutboxRecord[] = [];
		for (const r of this.records.values()) {
			if (r.publishedAt || this.inFlight.has(r.id)) continue;
			this.inFlight.add(r.id);
			claimed.push(r);
			if (claimed.length >= limit) break;
		}
		return claimed;
	}

	async markPublished(id: string): Promise<void> {
		const r = this.records.get(id);
		if (!r) return;
		r.publishedAt = new Date();
		this.inFlight.delete(id);
	}

	async markFailed(id: string, error: string): Promise<void> {
		const r = this.records.get(id);
		if (!r) return;
		r.attempts += 1;
		r.lastError = error;
		this.inFlight.delete(id);
	}
}
