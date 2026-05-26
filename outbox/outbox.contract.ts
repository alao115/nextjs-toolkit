/**
 * Outbox record — represents an event that was produced as part of a
 * database transaction and must be published to a downstream system
 * (message broker, webhook, audit sink) with at-least-once semantics.
 *
 * Persist the record in the SAME transaction as the business write,
 * then a separate worker drains pending records to the destination.
 * This is the standard pattern for avoiding dual-write inconsistency
 * (db commits but broker publish fails, or vice versa).
 */
export interface OutboxRecord {
	id: string;
	/** Aggregate / topic — e.g. "user", "order", "notification.email". */
	type: string;
	/** Domain payload. Should be JSON-serializable. */
	payload: Record<string, unknown>;
	/** When the record was enqueued. */
	createdAt: Date;
	/** When the record was successfully delivered, if at all. */
	publishedAt?: Date;
	/** Number of delivery attempts so far. */
	attempts: number;
	/** Last delivery error message, if any. */
	lastError?: string;
	/** Correlation IDs for cross-referencing with request logs. */
	correlation?: {
		requestId?: string;
		correlationId?: string;
		traceId?: string;
		tenantId?: string;
	};
}

export interface OutboxContract {
	/** Append a new record. Should run inside the caller's transaction. */
	enqueue(
		record: Omit<OutboxRecord, "id" | "createdAt" | "attempts">,
	): Promise<OutboxRecord>;

	/** Fetch up to `limit` un-published records, marking them in-flight. */
	claimPending(limit: number): Promise<OutboxRecord[]>;

	/** Mark a record as successfully published. */
	markPublished(id: string): Promise<void>;

	/** Record a delivery failure; increments `attempts` and stores the error. */
	markFailed(id: string, error: string): Promise<void>;
}

export const OUTBOX_PORT = Symbol("OUTBOX_PORT");
