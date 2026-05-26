/**
 * Canonical shape of an audit event. Persist these to a separate, tamper-evident
 * store (database table, append-only S3 bucket, SIEM sink) — NOT the same place
 * as application logs.
 */
export interface AuditEvent {
	/** ISO-8601 timestamp (the adapter sets this if omitted). */
	timestamp?: string;
	/** Subject performing the action — user id, service id, anonymous. */
	actor: {
		id: string;
		type: "user" | "service" | "system" | "anonymous";
		ip?: string;
		userAgent?: string;
	};
	/** Tenant under which the action occurred (multi-tenant systems). */
	tenantId?: string;
	/** What was attempted: e.g. `user.update`, `file.delete`, `auth.login`. */
	action: string;
	/** Resource the action targeted. */
	resource?: {
		type: string;
		id?: string;
		attributes?: Record<string, unknown>;
	};
	/** Outcome: did it succeed, fail, or get denied. */
	outcome: "success" | "failure" | "denied";
	/** Why it failed / was denied, if applicable. */
	reason?: string;
	/** Request correlation IDs for cross-referencing with app logs. */
	correlation?: {
		requestId?: string;
		correlationId?: string;
		traceId?: string;
	};
	/** Arbitrary additional structured attributes (already redacted). */
	attributes?: Record<string, unknown>;
}

export interface AuditLogContract {
	emit(event: AuditEvent): Promise<void> | void;
}

export const AUDIT_LOG_PORT = Symbol("AUDIT_LOG_PORT");
