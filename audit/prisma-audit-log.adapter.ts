import { Injectable } from "@nestjs/common";
import { AuditEvent, AuditLogContract } from "./audit.contract";
import { SealedAuditEvent, sealAuditEvent } from "./audit-chain";

export interface PrismaAuditLogConfig {
	/** Prisma client (typed `any` to avoid coupling to a specific schema). */
	prisma: any;
	/**
	 * Delegate name on the prisma client — defaults to `"auditEvent"`.
	 */
	modelName?: string;
	/**
	 * If true, every appended record is sealed into a tamper-evident chain
	 * with `previousHash` linking back to the previous record's `hash`.
	 * Default: true. Set false only for non-compliance audit trails.
	 */
	chained?: boolean;
}

/**
 * Append-only audit log adapter backed by a Prisma table. Records are
 * inserted in insertion order (`sequence` column) and (by default) sealed
 * into a tamper-evident hash chain.
 *
 * Required Prisma model:
 *
 *   model AuditEvent {
 *     id           String   @id @default(uuid())
 *     sequence     BigInt   @unique
 *     timestamp    DateTime @default(now())
 *     actorId      String
 *     actorType    String
 *     actorIp      String?
 *     tenantId     String?
 *     action       String
 *     resourceType String?
 *     resourceId   String?
 *     outcome      String
 *     reason       String?
 *     attributes   Json?
 *     correlation  Json?
 *     resource     Json?
 *     previousHash String?
 *     hash         String?
 *     @@index([tenantId, timestamp])
 *     @@index([action, timestamp])
 *   }
 *
 * To verify a chain segment:
 *   const rows = await prisma.auditEvent.findMany({ orderBy: { sequence: "asc" } });
 *   const broken = verifyAuditChain(rows.map(rowToSealed));
 *   if (broken !== -1) throw new Error(\`Audit chain broken at #\${broken}\`);
 *
 * **Database privileges**: the role used by this adapter should have
 * INSERT-only access to the audit table — no UPDATE, no DELETE. Define
 * that at the Postgres role level; the adapter can't enforce it.
 */
@Injectable()
export class PrismaAuditLogAdapter implements AuditLogContract {
	private readonly modelName: string;
	private readonly chained: boolean;

	constructor(private readonly cfg: PrismaAuditLogConfig) {
		this.modelName = cfg.modelName ?? "auditEvent";
		this.chained = cfg.chained ?? true;
	}

	private get model(): any {
		return this.cfg.prisma[this.modelName];
	}

	async emit(event: AuditEvent): Promise<void> {
		if (!this.chained) {
			await this.insert(event, null, null, null);
			return;
		}

		// Sequence + hash are determined inside a transaction so two concurrent
		// emits can't both link to the same `previousHash`.
		await this.cfg.prisma.$transaction(async (tx: any) => {
			const txModel = tx[this.modelName];
			const last = await txModel.findFirst({
				orderBy: { sequence: "desc" },
				select: { sequence: true, hash: true },
			});
			const previous: SealedAuditEvent | null = last
				? ({ ...event, sequence: Number(last.sequence), previousHash: "", hash: last.hash } as SealedAuditEvent)
				: null;
			const sealed = sealAuditEvent(event, previous);
			await this.insert(event, sealed.sequence, sealed.previousHash, sealed.hash, txModel);
		});
	}

	private async insert(
		event: AuditEvent,
		sequence: number | null,
		previousHash: string | null,
		hash: string | null,
		model?: any,
	): Promise<void> {
		const target = model ?? this.model;
		await target.create({
			data: {
				sequence,
				timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
				actorId: event.actor.id,
				actorType: event.actor.type,
				actorIp: event.actor.ip ?? null,
				tenantId: event.tenantId ?? null,
				action: event.action,
				resourceType: event.resource?.type ?? null,
				resourceId: event.resource?.id ?? null,
				outcome: event.outcome,
				reason: event.reason ?? null,
				attributes: event.attributes ?? null,
				correlation: event.correlation ?? null,
				resource: event.resource?.attributes ?? null,
				previousHash,
				hash,
			},
		});
	}
}
