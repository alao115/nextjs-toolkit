import { createHash } from "node:crypto";
import { AuditEvent } from "./audit.contract";

/**
 * A {@link SealedAuditEvent} is an {@link AuditEvent} that has been signed
 * into a tamper-evident chain. `previousHash` points at the previous record's
 * `hash`, so any retroactive edit invalidates everything after it.
 *
 * Verification: recompute `hash` for each record from its serialized payload +
 * `previousHash`, then check it matches the stored `hash`. A break in the
 * chain (or a hash mismatch) means the audit log was tampered with.
 */
export interface SealedAuditEvent extends AuditEvent {
	sequence: number;
	previousHash: string;
	hash: string;
}

const GENESIS_HASH = "0".repeat(64);

/**
 * Computes the canonical hash for an event. Stable across runs because we
 * sort keys before serializing.
 */
export function computeAuditHash(
	event: AuditEvent,
	previousHash: string,
	sequence: number,
): string {
	const canonical = JSON.stringify(
		{ event, previousHash, sequence },
		Object.keys({ event, previousHash, sequence }).sort(),
	);
	return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Returns the next sealed event in the chain.
 */
export function sealAuditEvent(
	event: AuditEvent,
	previous: SealedAuditEvent | null,
): SealedAuditEvent {
	const sequence = previous ? previous.sequence + 1 : 0;
	const previousHash = previous ? previous.hash : GENESIS_HASH;
	const hash = computeAuditHash(event, previousHash, sequence);
	return { ...event, sequence, previousHash, hash };
}

/**
 * Verifies a chain of sealed events. Returns the index of the first invalid
 * record, or -1 if the chain is intact.
 */
export function verifyAuditChain(events: SealedAuditEvent[]): number {
	let expectedPrev = GENESIS_HASH;
	for (let i = 0; i < events.length; i++) {
		const ev = events[i];
		if (ev.previousHash !== expectedPrev) return i;
		if (ev.sequence !== i) return i;
		const { sequence: _s, previousHash: _p, hash: _h, ...rest } = ev;
		const expectedHash = computeAuditHash(rest, expectedPrev, i);
		if (expectedHash !== ev.hash) return i;
		expectedPrev = ev.hash;
	}
	return -1;
}
