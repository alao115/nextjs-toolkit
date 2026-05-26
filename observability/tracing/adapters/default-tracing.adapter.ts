import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TracingContract, TracingSpan } from "../tracing.contract";

@Injectable()
export class DefaultNoopTracingAdapter implements TracingContract {
	startSpan(name: string, attributes?: Record<string, any>): TracingSpan {
		const spanId = this.generateSpanId();
		const traceId = attributes?.parentSpanId || this.generateTraceId();
		const startTime = Date.now();

		return {
			end: () => ({ name, traceId, spanId, duration: Date.now() - startTime }),
			setAttribute: () => {},
			setAttributes: () => {},
			recordException: () => {},
			addEvent: () => {},
		};
	}

	runInSpan<T>(
		name: string,
		fn: (span: TracingSpan) => T | Promise<T>,
		attributes?: Record<string, any>,
	): T | Promise<T> {
		const span = this.startSpan(name, attributes);
		try {
			const result = fn(span);
			if (result instanceof Promise) {
				return result
					.then((value) => {
						span.end();
						return value;
					})
					.catch((err) => {
						span.end(err);
						throw err;
					}) as any;
			}
			span.end();
			return result;
		} catch (err: any) {
			span.end(err);
			throw err;
		}
	}

	private generateTraceId() {
		return randomUUID();
	}

	private generateSpanId() {
		return randomUUID();
	}
}
