import {
	computeAuditHash,
	sealAuditEvent,
	verifyAuditChain,
	SealedAuditEvent,
} from "./audit-chain";
import { AuditEvent } from "./audit.contract";

const GENESIS = "0".repeat(64);

function event(action: string, overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		timestamp: "2026-01-01T00:00:00.000Z",
		actor: { id: "u1", type: "user" },
		action,
		outcome: "success",
		...overrides,
	};
}

/** Seals `actions` into a chain, in order. */
function chain(...actions: string[]): SealedAuditEvent[] {
	const out: SealedAuditEvent[] = [];
	for (const a of actions) {
		out.push(sealAuditEvent(event(a), out.length ? out[out.length - 1] : null));
	}
	return out;
}

describe("computeAuditHash", () => {
	it("is deterministic for the same inputs", () => {
		const ev = event("user.login");
		expect(computeAuditHash(ev, GENESIS, 0)).toBe(
			computeAuditHash(ev, GENESIS, 0),
		);
	});

	it("returns a 64-char hex sha256 digest", () => {
		expect(computeAuditHash(event("a"), GENESIS, 0)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is independent of key insertion order", () => {
		const a: AuditEvent = {
			actor: { id: "u1", type: "user" },
			action: "x",
			outcome: "success",
		};
		const b: AuditEvent = {
			outcome: "success",
			action: "x",
			actor: { id: "u1", type: "user" },
		};
		expect(computeAuditHash(a, GENESIS, 0)).toBe(computeAuditHash(b, GENESIS, 0));
	});

	it("changes when the event changes", () => {
		expect(computeAuditHash(event("a"), GENESIS, 0)).not.toBe(
			computeAuditHash(event("b"), GENESIS, 0),
		);
	});

	it("changes when previousHash changes", () => {
		const ev = event("a");
		expect(computeAuditHash(ev, GENESIS, 0)).not.toBe(
			computeAuditHash(ev, "f".repeat(64), 0),
		);
	});

	it("changes when sequence changes", () => {
		const ev = event("a");
		expect(computeAuditHash(ev, GENESIS, 0)).not.toBe(
			computeAuditHash(ev, GENESIS, 1),
		);
	});
});

describe("sealAuditEvent", () => {
	it("seals the first event against the genesis hash at sequence 0", () => {
		const sealed = sealAuditEvent(event("first"), null);
		expect(sealed.sequence).toBe(0);
		expect(sealed.previousHash).toBe(GENESIS);
		expect(sealed.hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("links each event to its predecessor's hash and increments sequence", () => {
		const [a, b] = chain("first", "second");
		expect(b.sequence).toBe(1);
		expect(b.previousHash).toBe(a.hash);
	});

	it("preserves the original event fields", () => {
		const ev = event("user.delete", { reason: "gdpr", tenantId: "t1" });
		const sealed = sealAuditEvent(ev, null);
		expect(sealed.action).toBe("user.delete");
		expect(sealed.reason).toBe("gdpr");
		expect(sealed.tenantId).toBe("t1");
	});

	it("gives identical events different hashes at different positions", () => {
		const first = sealAuditEvent(event("same"), null);
		const second = sealAuditEvent(event("same"), first);
		expect(second.hash).not.toBe(first.hash);
	});
});

describe("verifyAuditChain", () => {
	it("accepts an empty chain", () => {
		expect(verifyAuditChain([])).toBe(-1);
	});

	it("accepts an intact chain", () => {
		expect(verifyAuditChain(chain("a", "b", "c"))).toBe(-1);
	});

	it("detects a mutated payload", () => {
		const events = chain("a", "b", "c");
		events[1] = { ...events[1], action: "tampered" };
		expect(verifyAuditChain(events)).toBe(1);
	});

	it("detects a mutated outcome — the denial-to-success rewrite", () => {
		const events = chain("a", "b");
		events[1] = { ...events[1], outcome: "success" as const };
		const denied = chain("a");
		const sealedDenied = sealAuditEvent(
			event("b", { outcome: "denied" }),
			denied[0],
		);
		expect(
			verifyAuditChain([denied[0], { ...sealedDenied, outcome: "success" }]),
		).toBe(1);
	});

	it("detects a deleted record (broken link + wrong sequence)", () => {
		const events = chain("a", "b", "c");
		expect(verifyAuditChain([events[0], events[2]])).toBe(1);
	});

	it("detects a record inserted at the front", () => {
		const events = chain("a", "b");
		const forged = sealAuditEvent(event("forged"), null);
		expect(verifyAuditChain([forged, ...events])).toBe(1);
	});

	it("detects a re-pointed previousHash", () => {
		const events = chain("a", "b", "c");
		events[2] = { ...events[2], previousHash: events[0].hash };
		expect(verifyAuditChain(events)).toBe(2);
	});

	it("detects a rewritten hash", () => {
		const events = chain("a", "b");
		events[1] = { ...events[1], hash: "0".repeat(64) };
		expect(verifyAuditChain(events)).toBe(1);
	});

	it("detects a chain that does not start at genesis", () => {
		const events = chain("a", "b");
		expect(verifyAuditChain([events[1]])).toBe(0);
	});

	it("detects reordered records", () => {
		const events = chain("a", "b", "c");
		expect(verifyAuditChain([events[0], events[2], events[1]])).toBe(1);
	});

	it("reports the earliest break when several records are tampered with", () => {
		const events = chain("a", "b", "c", "d");
		events[1] = { ...events[1], action: "x" };
		events[3] = { ...events[3], action: "y" };
		expect(verifyAuditChain(events)).toBe(1);
	});
});
