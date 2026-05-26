import { InMemoryRateLimitAdapter } from "./in-memory-rate-limit.adapter";

describe("InMemoryRateLimitAdapter", () => {
	it("allows requests up to max within the window", async () => {
		const rl = new InMemoryRateLimitAdapter({ max: 3, windowMs: 1000 });
		for (let i = 0; i < 3; i++) {
			const d = await rl.consume("user-1");
			expect(d.allowed).toBe(true);
		}
	});

	it("denies the request that exceeds max, with retryAfterMs", async () => {
		const rl = new InMemoryRateLimitAdapter({ max: 2, windowMs: 1000 });
		await rl.consume("u");
		await rl.consume("u");
		const denied = await rl.consume("u");
		expect(denied.allowed).toBe(false);
		expect(denied.remaining).toBe(0);
		expect(denied.retryAfterMs).toBeGreaterThan(0);
		expect(denied.retryAfterMs).toBeLessThanOrEqual(1000);
	});

	it("resets after the window expires", async () => {
		const rl = new InMemoryRateLimitAdapter({ max: 1, windowMs: 10 });
		await rl.consume("u");
		await expect(rl.consume("u")).resolves.toMatchObject({ allowed: false });
		await new Promise((r) => setTimeout(r, 15));
		await expect(rl.consume("u")).resolves.toMatchObject({ allowed: true });
	});

	it("isolates buckets per key", async () => {
		const rl = new InMemoryRateLimitAdapter({ max: 1, windowMs: 1000 });
		await rl.consume("a");
		await expect(rl.consume("a")).resolves.toMatchObject({ allowed: false });
		await expect(rl.consume("b")).resolves.toMatchObject({ allowed: true });
	});

	it("respects custom cost values", async () => {
		const rl = new InMemoryRateLimitAdapter({ max: 5, windowMs: 1000 });
		const d1 = await rl.consume("u", 3);
		expect(d1.allowed).toBe(true);
		expect(d1.remaining).toBe(2);
		const d2 = await rl.consume("u", 3);
		expect(d2.allowed).toBe(false);
	});
});
