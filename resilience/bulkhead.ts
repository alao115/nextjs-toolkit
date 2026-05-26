export class BulkheadFullError extends Error {
	constructor(name: string, maxQueueSize: number) {
		super(`Bulkhead "${name}" is full (queue >= ${maxQueueSize})`);
		this.name = "BulkheadFullError";
	}
}

export interface BulkheadOptions {
	/** Maximum concurrent in-flight calls. */
	maxConcurrent: number;
	/**
	 * Maximum number of pending callers to queue when concurrency limit is
	 * reached. Set to 0 for fail-fast (reject when full). Default: 0.
	 */
	maxQueueSize?: number;
}

interface Waiter {
	resolve: () => void;
	reject: (err: Error) => void;
}

/**
 * Bulkhead pattern: caps concurrent calls to a downstream dependency so one
 * slow dependency can't starve a service of workers.
 *
 * Create one instance per dependency (e.g. one for the search backend,
 * another for the mail gateway).
 */
export class Bulkhead {
	private inFlight = 0;
	private readonly queue: Waiter[] = [];

	constructor(
		private readonly name: string,
		private readonly options: BulkheadOptions,
	) {}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await fn();
		} finally {
			this.release();
		}
	}

	getInFlight(): number {
		return this.inFlight;
	}

	getQueueLength(): number {
		return this.queue.length;
	}

	private acquire(): Promise<void> {
		if (this.inFlight < this.options.maxConcurrent) {
			this.inFlight++;
			return Promise.resolve();
		}
		const maxQ = this.options.maxQueueSize ?? 0;
		if (this.queue.length >= maxQ) {
			return Promise.reject(new BulkheadFullError(this.name, maxQ));
		}
		return new Promise<void>((resolve, reject) => {
			this.queue.push({ resolve, reject });
		});
	}

	private release(): void {
		const next = this.queue.shift();
		if (next) {
			next.resolve();
		} else {
			this.inFlight = Math.max(0, this.inFlight - 1);
		}
	}
}
