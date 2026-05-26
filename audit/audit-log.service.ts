import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	AUDIT_LOG_PORT,
	AuditEvent,
	AuditLogContract,
} from "./audit.contract";
import { ActorResolver } from "./actor-resolver";
import { RequestContextService } from "../context";

export type AuditEmitInput =
	Partial<Pick<AuditEvent, "actor" | "tenantId" | "correlation" | "timestamp">>
	& Omit<AuditEvent, "actor" | "tenantId" | "correlation" | "timestamp">;

/**
 * Public entry point for emitting audit events. Wraps the configured
 * {@link AuditLogContract} adapter and auto-enriches with request-context
 * correlation IDs, tenant id, and a resolved actor.
 */
@Injectable()
export class AuditLogService {
	constructor(
		@Optional()
		@Inject(AUDIT_LOG_PORT)
		private readonly impl: AuditLogContract | null,
		private readonly ctx: RequestContextService,
		private readonly actorResolver: ActorResolver,
	) {}

	async emit(event: AuditEmitInput): Promise<void> {
		if (!this.impl) return;
		const reqCtx = this.ctx.getContext();
		const enriched: AuditEvent = {
			timestamp: event.timestamp ?? new Date().toISOString(),
			...event,
			actor: event.actor ?? this.actorResolver.resolve(),
			tenantId: event.tenantId ?? reqCtx?.tenantId,
			correlation: event.correlation ?? {
				requestId: reqCtx?.requestId,
				correlationId: reqCtx?.correlationId,
				traceId: reqCtx?.traceId,
			},
		};
		await this.impl.emit(enriched);
	}
}
