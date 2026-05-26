export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
	/** Failures within the rolling window that trip the breaker. */
	failureThreshold?: number;
	/** Milliseconds the breaker stays open before allowing a probe. */
	resetTimeoutMs?: number;
	/** Successful probes in `half-open` required to close the breaker. */
	halfOpenSuccessThreshold?: number;
}

export class CircuitOpenError extends Error {
	constructor(name: string) {
		super(`Circuit "${name}" is open`);
		this.name = "CircuitOpenError";
	}
}

const DEFAULTS: Required<CircuitBreakerOptions> = {
	failureThreshold: 5,
	resetTimeoutMs: 30_000,
	halfOpenSuccessThreshold: 2,
};

/**
 * Minimal in-memory circuit breaker. Suitable for wrapping a single
 * downstream call site; create one instance per dependency.
 *
 * Not distributed — for fleet-wide breakers use a shared store
 * (Redis, etc.) or a dedicated lib.
 */
export class CircuitBreaker {
	private state: CircuitState = "closed";
	private failureCount = 0;
	private halfOpenSuccesses = 0;
	private openedAt = 0;
	private readonly opts: Required<CircuitBreakerOptions>;

	constructor(
		private readonly name: string,
		options: CircuitBreakerOptions = {},
	) {
		this.opts = { ...DEFAULTS, ...options };
	}

	getState(): CircuitState {
		return this.state;
	}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		if (this.state === "open") {
			if (Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
				this.state = "half-open";
				this.halfOpenSuccesses = 0;
			} else {
				throw new CircuitOpenError(this.name);
			}
		}

		try {
			const result = await fn();
			this.onSuccess();
			return result;
		} catch (err) {
			this.onFailure();
			throw err;
		}
	}

	private onSuccess(): void {
		if (this.state === "half-open") {
			this.halfOpenSuccesses++;
			if (this.halfOpenSuccesses >= this.opts.halfOpenSuccessThreshold) {
				this.state = "closed";
				this.failureCount = 0;
			}
		} else {
			this.failureCount = 0;
		}
	}

	private onFailure(): void {
		this.failureCount++;
		if (
			this.state === "half-open" ||
			this.failureCount >= this.opts.failureThreshold
		) {
			this.state = "open";
			this.openedAt = Date.now();
		}
	}
}
