import { Inject, Injectable, Optional } from "@nestjs/common";
import { TRACING_PORT, TracingContract, TracingSpan } from "./tracing.contract";
import { RequestContextService } from "../../context";

export interface SpanOptions {
	name: string;
	attributes?: Record<string, any>;
}

export interface Span {
	end: (err?: Error) => void;
}

@Injectable()
export class TracingService {
	constructor(
		private readonly ctxService: RequestContextService,
		@Optional()
		@Inject(TRACING_PORT)
		private readonly tracingPort?: TracingContract,
	) {}

	startSpan(name: string, attributes: Record<string, any> = {}): TracingSpan {
		const ctx = this.ctxService.getContext();
		const enrichedAttrs = {
			...attributes,
			traceId: ctx?.traceId,
			correlationId: ctx?.correlationId,
			requestId: ctx?.requestId,
			userId: ctx?.userId,
		};

		if (!this.tracingPort) {
			// fallback noop
			return {
				end: () => {},
				setAttribute: () => {},
				setAttributes: () => {},
				recordException: () => {},
			};
		}

		return this.tracingPort.startSpan(name, enrichedAttrs);
	}

	runInSpan<T>(
		name: string,
		fn: (span: TracingSpan) => T | Promise<T>,
		attributes: Record<string, any> = {},
	): T | Promise<T> {
		const ctx = this.ctxService.getContext();
		const enrichedAttrs = {
			...attributes,
			traceId: ctx?.traceId,
			correlationId: ctx?.correlationId,
			requestId: ctx?.requestId,
			userId: ctx?.userId,
		};

		if (!this.tracingPort) {
			return fn(undefined as any);
		}
		return this.tracingPort.runInSpan(name, fn, enrichedAttrs);
	}
}
