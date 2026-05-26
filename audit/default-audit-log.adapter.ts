import { Injectable } from "@nestjs/common";
import { LoggerService } from "../observability/logger/logger.service";
import { AuditEvent, AuditLogContract } from "./audit.contract";

/**
 * Default audit-log adapter — emits to the application logger with a fixed
 * `category: "audit"` tag so log shippers can route audit lines to a separate
 * index. **Not** a substitute for a real audit store in regulated environments.
 */
@Injectable()
export class DefaultAuditLogAdapter implements AuditLogContract {
	constructor(private readonly logger: LoggerService) {}

	emit(event: AuditEvent): void {
		this.logger.info("audit", {
			category: "audit",
			...event,
			timestamp: event.timestamp ?? new Date().toISOString(),
		});
	}
}
