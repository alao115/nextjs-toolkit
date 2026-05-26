import {
	CircuitBreaker,
	CircuitOpenError,
	retry,
	TimeoutError,
	withTimeout,
} from "./index";

describe("withTimeout", () => {
	it("resolves when the inner promise wins the race", async () => {
		const result = await withTimeout(Promise.resolve("ok"), 50);
		expect(result).toBe("ok");
	});

	it("rejects with TimeoutError when the timer fires first", async () => {
		await expect(
			withTimeout(new Promise((resolve) => setTimeout(resolve, 100)), 10, "op"),
		).rejects.toBeInstanceOf(TimeoutError);
	});

	it("passes through inner promise rejection unchanged", async () => {
		const err = new Error("boom");
		await expect(withTimeout(Promise.reject(err), 100)).rejects.toBe(err);
	});

	it("with ms <= 0, returns the promise as-is (no timer)", async () => {
		const result = await withTimeout(Promise.resolve(123), 0);
		expect(result).toBe(123);
	});
});

describe("retry", () => {
	it("returns the value on first success", async () => {
		const fn = jest.fn().mockResolvedValueOnce("ok");
		await expect(retry(fn)).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries up to maxRetries then rethrows", async () => {
		const fn = jest.fn().mockRejectedValue(new Error("nope"));
		await expect(
			retry(fn, { maxRetries: 2, baseBackoffMs: 1, jitterMs: 0 }),
		).rejects.toThrow("nope");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("succeeds on a retry attempt", async () => {
		const fn = jest
			.fn()
			.mockRejectedValueOnce(new Error("x"))
			.mockResolvedValueOnce("ok");
		await expect(
			retry(fn, { maxRetries: 3, baseBackoffMs: 1, jitterMs: 0 }),
		).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("respects shouldRetry returning false", async () => {
		const fn = jest.fn().mockRejectedValue(new Error("fatal"));
		await expect(
			retry(fn, {
				maxRetries: 5,
				baseBackoffMs: 1,
				jitterMs: 0,
				shouldRetry: () => false,
			}),
		).rejects.toThrow("fatal");
		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe("CircuitBreaker", () => {
	it("opens after failureThreshold failures", async () => {
		const cb = new CircuitBreaker("test", {
			failureThreshold: 2,
			resetTimeoutMs: 1000,
		});
		const failing = () => Promise.reject(new Error("x"));
		await expect(cb.run(failing)).rejects.toThrow("x");
		await expect(cb.run(failing)).rejects.toThrow("x");
		expect(cb.getState()).toBe("open");
		await expect(cb.run(failing)).rejects.toBeInstanceOf(CircuitOpenError);
	});

	it("transitions to half-open after resetTimeoutMs", async () => {
		const cb = new CircuitBreaker("test", {
			failureThreshold: 1,
			resetTimeoutMs: 5,
			halfOpenSuccessThreshold: 1,
		});
		await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow();
		expect(cb.getState()).toBe("open");
		await new Promise((r) => setTimeout(r, 10));
		// First post-timeout call enters half-open and is allowed; success closes it.
		await expect(cb.run(() => Promise.resolve("ok"))).resolves.toBe("ok");
		expect(cb.getState()).toBe("closed");
	});

	it("re-opens on failure in half-open", async () => {
		const cb = new CircuitBreaker("test", {
			failureThreshold: 1,
			resetTimeoutMs: 5,
		});
		await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow();
		await new Promise((r) => setTimeout(r, 10));
		await expect(cb.run(() => Promise.reject(new Error("y")))).rejects.toThrow();
		expect(cb.getState()).toBe("open");
	});
});
