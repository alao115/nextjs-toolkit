/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 02 — Audit logging.
 *
 * Shows:
 *  - Wiring `AuditModule` with the Prisma adapter (real append-only store).
 *  - Emitting an event with auto-resolved actor + tenant + correlation.
 *  - Verifying the tamper-evident chain at the end of an audit cycle.
 */

import { Inject, Injectable, Module } from "@nestjs/common";
import {
	AuditLogService,
	AuditModule,
	PrismaAuditLogAdapter,
	SealedAuditEvent,
	verifyAuditChain,
	AUDIT_LOG_PORT,
	AuditLogContract,
} from "@alaska115/nextjs-toolkit/audit";

// Your Prisma client (with the `AuditEvent` model from `audit/README.md`).
declare const prisma: any;

// ─── Wiring ───────────────────────────────────────────────────────────────

@Module({
	imports: [
		AuditModule.forRoot({
			// Pass the Prisma adapter as the AUDIT_LOG_PORT implementation.
			// (See AuditModule.forRoot signature — you can override the adapter
			//  class; here we supply an instance via a custom provider instead.)
		}),
	],
	providers: [
		{
			provide: AUDIT_LOG_PORT,
			useFactory: () =>
				new PrismaAuditLogAdapter({
					prisma,
					modelName: "auditEvent", // default
					chained: true, // tamper-evident hash chain
				}),
		},
	],
})
export class AuditExampleModule {}

// ─── Emitting events ──────────────────────────────────────────────────────

@Injectable()
export class UserService {
	constructor(private readonly audit: AuditLogService) {}

	async deleteUser(id: string): Promise<void> {
		try {
			await prisma.user.delete({ where: { id } });
			// `actor`, `tenantId`, and `correlation` are filled in by the
			// AuditLogService from the active RequestContext.
			await this.audit.emit({
				action: "user.delete",
				resource: { type: "user", id },
				outcome: "success",
			});
		} catch (err) {
			await this.audit.emit({
				action: "user.delete",
				resource: { type: "user", id },
				outcome: "failure",
				reason: (err as Error).message,
			});
			throw err;
		}
	}

	async denyAction(id: string, reason: string): Promise<void> {
		await this.audit.emit({
			action: "user.permission.denied",
			resource: { type: "user", id },
			outcome: "denied",
			reason,
		});
	}
}

// ─── Verifying the chain ──────────────────────────────────────────────────

/**
 * A periodic job (cron, k8s CronJob) that streams the audit table and
 * checks the hash chain. Alert if anything is broken.
 */
export async function verifyAuditChainNightly(): Promise<void> {
	const rows = await prisma.auditEvent.findMany({
		orderBy: { sequence: "asc" },
	});

	// Map rows back to `SealedAuditEvent` shape.
	const sealed: SealedAuditEvent[] = rows.map((r: any) => ({
		sequence: Number(r.sequence),
		previousHash: r.previousHash,
		hash: r.hash,
		timestamp: r.timestamp.toISOString(),
		actor: { id: r.actorId, type: r.actorType, ip: r.actorIp ?? undefined },
		tenantId: r.tenantId ?? undefined,
		action: r.action,
		resource: r.resourceType
			? {
					type: r.resourceType,
					id: r.resourceId ?? undefined,
					attributes: r.resource ?? undefined,
				}
			: undefined,
		outcome: r.outcome,
		reason: r.reason ?? undefined,
		attributes: r.attributes ?? undefined,
		correlation: r.correlation ?? undefined,
	}));

	const brokenAt = verifyAuditChain(sealed);
	if (brokenAt === -1) {
		console.log(`[audit] chain intact (${sealed.length} records verified)`);
	} else {
		// Page on-call. This is one of the few "wake people up at 3am" events.
		throw new Error(
			`Audit chain tampered: record #${brokenAt} doesn't match expected hash`,
		);
	}
}
