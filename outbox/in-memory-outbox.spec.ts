import { InMemoryOutboxAdapter } from "./in-memory-outbox.adapter";

describe("InMemoryOutboxAdapter", () => {
	it("enqueues and assigns id, createdAt, attempts=0", async () => {
		const out = new InMemoryOutboxAdapter();
		const rec = await out.enqueue({ type: "user.created", payload: { id: 1 } });
		expect(rec.id).toBeTruthy();
		expect(rec.createdAt).toBeInstanceOf(Date);
		expect(rec.attempts).toBe(0);
		expect(rec.publishedAt).toBeUndefined();
	});

	it("claimPending returns unpublished records up to limit", async () => {
		const out = new InMemoryOutboxAdapter();
		await out.enqueue({ type: "x", payload: {} });
		await out.enqueue({ type: "x", payload: {} });
		await out.enqueue({ type: "x", payload: {} });
		const batch = await out.claimPending(2);
		expect(batch).toHaveLength(2);
	});

	it("claimPending does NOT redeliver in-flight records", async () => {
		const out = new InMemoryOutboxAdapter();
		await out.enqueue({ type: "x", payload: {} });
		const first = await out.claimPending(10);
		const second = await out.claimPending(10);
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(0);
	});

	it("markPublished prevents re-delivery", async () => {
		const out = new InMemoryOutboxAdapter();
		const rec = await out.enqueue({ type: "x", payload: {} });
		const [claimed] = await out.claimPending(1);
		await out.markPublished(claimed.id);
		// reset in-flight by claiming again — must be empty since published
		const next = await out.claimPending(10);
		expect(next).toHaveLength(0);
		expect(rec.id).toBe(claimed.id);
	});

	it("markFailed increments attempts and stores error; releases in-flight", async () => {
		const out = new InMemoryOutboxAdapter();
		const rec = await out.enqueue({ type: "x", payload: {} });
		await out.claimPending(1);
		await out.markFailed(rec.id, "smtp down");
		// After failure, the record becomes re-claimable
		const next = await out.claimPending(10);
		expect(next).toHaveLength(1);
		expect(next[0].attempts).toBe(1);
		expect(next[0].lastError).toBe("smtp down");
	});
});
