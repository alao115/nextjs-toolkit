import { Injectable } from "@nestjs/common";
import { RequestContextService } from "../context";
import { AuditEvent } from "./audit.contract";

/**
 * Resolves the {@link AuditEvent.actor} for the current request from
 * the active {@link RequestContextService}. Consumers usually don't call
 * this directly — {@link AuditLogService.emit} uses it as a fallback when
 * no explicit `actor` is provided.
 *
 * - Authenticated requests → `{ id: userId, type: "user" }`
 * - System / cron / queue worker → `{ id: "system", type: "system" }`
 * - Public endpoints → `{ id: "anonymous", type: "anonymous" }`
 */
@Injectable()
export class ActorResolver {
	constructor(private readonly ctx: RequestContextService) {}

	resolve(): AuditEvent["actor"] {
		const reqCtx = this.ctx.getContext();
		if (reqCtx?.userId) {
			return {
				id: reqCtx.userId,
				type: "user",
				ip: reqCtx.ip,
			};
		}
		if (!reqCtx) {
			return { id: "system", type: "system" };
		}
		return { id: "anonymous", type: "anonymous", ip: reqCtx.ip };
	}
}
