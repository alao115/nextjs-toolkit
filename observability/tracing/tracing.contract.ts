export interface TracingSpan {
	end(error?: Error): void;
	setAttribute(key: string, value: string | number | boolean): void;
	setAttributes(attrs: Record<string, string | number | boolean>): void;
	recordException(error: Error): void;
	/**
	 * Record a named, timestamped event on this span. Adapters that don't
	 * support events may no-op. Useful for marking discrete moments
	 * ("cache.miss", "queue.dispatched") inside a long-running span.
	 */
	addEvent?(name: string, attributes?: Record<string, string | number | boolean>): void;
}

export interface TracingContract {
	startSpan(name: string, attributes?: Record<string, any>): TracingSpan;

	runInSpan<T>(
		name: string,
		fn: (span: TracingSpan) => T | Promise<T>,
		attributes?: Record<string, any>,
	): T | Promise<T>;
}

export const TRACING_PORT = Symbol("TRACING_PORT");
