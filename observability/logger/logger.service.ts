import { Injectable, Optional } from "@nestjs/common";
import {
	LogLevel,
	LogContext,
	LogEvent,
	LoggingContract,
} from "./logging.contract";
import { ErrorTrackingService } from "../error-tracker/error-tracking.service";
import { RequestContextService } from "../../context";

@Injectable()
export class LoggerService {
	constructor(
		private readonly ctxService: RequestContextService,
		@Optional() private readonly errorTracker?: ErrorTrackingService,
		@Optional() private readonly loggingPort?: LoggingContract,
	) {}

	private emit(level: LogLevel, message: string, meta: LogContext = {}) {
		const ctx = this.ctxService.getContext();

		const enriched: LogContext = {
			...meta,
			traceId: meta.traceId ?? ctx?.traceId,
			correlationId: meta.correlationId ?? ctx?.correlationId,
			requestId: meta.requestId ?? ctx?.requestId,
			...(ctx?.userId && !meta.userId ? { userId: ctx.userId } : {}),
			...(ctx?.tenantId && !meta.tenantId ? { tenantId: ctx.tenantId } : {}),
			timestamp: meta.timestamp ?? new Date().toISOString(),
		};

		if (this.loggingPort) {
			this.loggingPort.log(level, message, enriched);
		} else {
			console.log(JSON.stringify({ level, message, ...enriched }));
		}
	}

	/**
	 * Emit a structured {@link LogEvent}. Use this when you want to enforce
	 * the canonical log shape — `severity`, `message`, optional `error`,
	 * `http`, `attributes`, etc. — over the free-form `LogContext`.
	 *
	 * Auto-enriches with active request-context IDs the same as `info/error/...`.
	 */
	event(event: LogEvent): void {
		const { severity, message, ...rest } = event;
		this.emit(severity, message, rest as LogContext);
	}

	fatal(message: string, meta?: LogContext) {
		this.emit("fatal", message, meta);
	}

	error(message: string, meta?: LogContext) {
		this.emit("error", message, meta);
		if (meta?.error) {
			this.errorTracker?.captureError(meta.error, meta);
		}
	}

	warn(message: string, meta?: LogContext) {
		this.emit("warn", message, meta);
	}

	info(message: string, meta?: LogContext) {
		this.emit("info", message, meta);
	}

	debug(message: string, meta?: LogContext) {
		this.emit("debug", message, meta);
	}

	trace(message: string, meta?: LogContext) {
		this.emit("trace", message, meta);
	}
}
