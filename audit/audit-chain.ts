import { createHash } from "node:crypto";
import { AuditEvent } from "./audit.contract.js";

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
 * Recursively sorts object keys so two structurally equal values always
 * serialize to the same string, regardless of insertion order.
 *
 * Do NOT replace this with `JSON.stringify(value, keyArray)`: an array
 * replacer is a property allow-list applied at *every* depth, so it silently
 * strips nested fields. That bug made every event hash to the same digest
 * regardless of its contents, which defeated the whole chain.
 */
function canonicalize(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(canonicalize);

	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		const inner = (value as Record<string, unknown>)[key];
		// Match JSON semantics: an explicit `undefined` and an absent key are
		// the same thing, so they must hash the same.
		if (inner !== undefined) sorted[key] = canonicalize(inner);
	}
	return sorted;
}

/**
 * Computes the canonical hash for an event. Stable across runs and across
 * key insertion order, because the payload is canonicalized before hashing.
 */
export function computeAuditHash(
	event: AuditEvent,
	previousHash: string,
	sequence: number,
): string {
	const canonical = JSON.stringify(
		canonicalize({ event, previousHash, sequence }),
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
