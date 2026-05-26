export class TimeoutError extends Error {
	constructor(ms: number, op?: string) {
		super(
			op
				? `Operation "${op}" timed out after ${ms}ms`
				: `Operation timed out after ${ms}ms`,
		);
		this.name = "TimeoutError";
	}
}

/**
 * Race `promise` against a timer. If the timer fires first, the returned
 * promise rejects with {@link TimeoutError}. Note: the underlying `promise`
 * is NOT cancelled — pass an `AbortController` through if cancellation matters.
 */
export function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	op?: string,
): Promise<T> {
	if (ms <= 0) return promise;
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new TimeoutError(ms, op)), ms);
		promise.then(
			(v) => {
				clearTimeout(timer);
				resolve(v);
			},
			(e) => {
				clearTimeout(timer);
				reject(e);
			},
		);
	});
}
