export interface RetryOptions {
	maxRetries?: number;
	baseBackoffMs?: number;
	maxBackoffMs?: number;
	jitterMs?: number;
	/** Return false to abort retrying for this error. Default: retry everything. */
	shouldRetry?: (err: unknown, attempt: number) => boolean;
	/** Called with each error before sleeping. Useful for telemetry. */
	onError?: (err: unknown, attempt: number) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, "shouldRetry" | "onError">> = {
	maxRetries: 3,
	baseBackoffMs: 200,
	maxBackoffMs: 4000,
	jitterMs: 100,
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * If `err` carries a `Retry-After` hint (HTTP-style — either a number of
 * seconds, an HTTP-date, or a `retryAfterMs` property), returns the
 * corresponding milliseconds. Otherwise undefined.
 *
 * Recognized shapes:
 *  - `err.retryAfterMs: number`
 *  - `err.headers?.["retry-after"]: string` (seconds, or HTTP date)
 *  - `err.response?.headers?.["retry-after"]: string`
 */
function extractRetryAfterMs(err: unknown): number | undefined {
	if (!err || typeof err !== "object") return undefined;
	const e = err as any;
	if (typeof e.retryAfterMs === "number" && e.retryAfterMs >= 0) {
		return e.retryAfterMs;
	}
	const raw =
		e.headers?.["retry-after"] ?? e.response?.headers?.["retry-after"];
	if (typeof raw !== "string") return undefined;
	const asNum = Number(raw);
	if (Number.isFinite(asNum) && asNum >= 0) return asNum * 1000;
	const asDate = Date.parse(raw);
	if (Number.isFinite(asDate)) {
		return Math.max(0, asDate - Date.now());
	}
	return undefined;
}

/**
 * Retry `fn` with exponential backoff + jitter. Throws the last error if
 * `maxRetries` is reached or `shouldRetry` returns false.
 */
export async function retry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const opts = { ...DEFAULTS, ...options };
	let lastError: unknown;

	for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			options.onError?.(err, attempt);
			if (options.shouldRetry && !options.shouldRetry(err, attempt)) break;
			if (attempt >= opts.maxRetries) break;
			const serverHint = extractRetryAfterMs(err);
			const backoff = Math.min(
				opts.maxBackoffMs,
				opts.baseBackoffMs * 2 ** attempt,
			);
			const jitter = Math.random() * opts.jitterMs;
			const delay =
				serverHint !== undefined
					? Math.min(opts.maxBackoffMs, serverHint) + jitter
					: backoff + jitter;
			await sleep(delay);
		}
	}

	throw lastError;
}
