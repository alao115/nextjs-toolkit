import { Injectable } from "@nestjs/common";
import { LogContext, LoggingContract, LogLevel } from "../logging.contract";

@Injectable()
export class DefaultConsoleLoggingAdapter implements LoggingContract {
	log(level: LogLevel, message: string, meta?: LogContext): void {
		const payload = { level, message, ...(meta || {}) };
		console.log(JSON.stringify(payload));
	}
}
