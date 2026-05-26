import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OutboxContract, OutboxRecord } from "./outbox.contract";

/**
 * Prisma-backed outbox adapter. Expects a model with the following shape:
 *
 *   model OutboxEvent {
 *     id           String   @id @default(uuid())
 *     type         String
 *     payload      Json
 *     createdAt    DateTime @default(now())
 *     publishedAt  DateTime?
 *     attempts     Int      @default(0)
 *     lastError    String?
 *     claimedAt    DateTime?
 *     correlationRequestId  String?
 *     correlationCorrelationId String?
 *     correlationTraceId    String?
 *     correlationTenantId   String?
 *     @@index([publishedAt, claimedAt])
 *   }
 *
 * The `claimedAt` field is used as an at-least-once delivery lock: the worker
 * sets it when claiming, clears it on failure. A `staleClaimAfterMs` config
 * lets the worker reclaim records whose previous handler crashed.
 *
 * Construct via `new PrismaOutboxAdapter({ prisma, modelName: "outboxEvent" })`
 * — consumers can name the model whatever they want.
 */

export interface PrismaOutboxConfig {
	/** Prisma client instance (typed `any` to avoid coupling to a specific schema). */
	prisma: any;
	/**
	 * Delegate name on the prisma client — e.g. `"outboxEvent"` for
	 * `prisma.outboxEvent`. Defaults to `"outboxEvent"`.
	 */
	modelName?: string;
	/**
	 * If a record's `claimedAt` is older than this many milliseconds, it
	 * becomes re-claimable. Default: 5 minutes.
	 */
	staleClaimAfterMs?: number;
}

@Injectable()
export class PrismaOutboxAdapter implements OutboxContract {
	private readonly modelName: string;
	private readonly staleMs: number;

	constructor(private readonly cfg: PrismaOutboxConfig) {
		this.modelName = cfg.modelName ?? "outboxEvent";
		this.staleMs = cfg.staleClaimAfterMs ?? 5 * 60_000;
	}

	private get model(): any {
		return this.cfg.prisma[this.modelName];
	}

	async enqueue(
		input: Omit<OutboxRecord, "id" | "createdAt" | "attempts">,
	): Promise<OutboxRecord> {
		const row = await this.model.create({
			data: {
				id: randomUUID(),
				type: input.type,
				payload: input.payload,
				publishedAt: input.publishedAt ?? null,
				attempts: 0,
				lastError: input.lastError ?? null,
				correlationRequestId: input.correlation?.requestId ?? null,
				correlationCorrelationId: input.correlation?.correlationId ?? null,
				correlationTraceId: input.correlation?.traceId ?? null,
				correlationTenantId: input.correlation?.tenantId ?? null,
			},
		});
		return this.toRecord(row);
	}

	async claimPending(limit: number): Promise<OutboxRecord[]> {
		const staleBefore = new Date(Date.now() - this.staleMs);
		// Atomic: find + update in one transaction so two workers can't claim
		// the same record. Using `updateMany` then re-select by claimedAt
		// works on Postgres without explicit row locks.
		return this.cfg.prisma.$transaction(async (tx: any) => {
			const txModel = tx[this.modelName];
			const candidates = await txModel.findMany({
				where: {
					publishedAt: null,
					OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
				},
				orderBy: { createdAt: "asc" },
				take: limit,
			});

			if (candidates.length === 0) return [];

			const claimedAt = new Date();
			await txModel.updateMany({
				where: { id: { in: candidates.map((c: any) => c.id) } },
				data: { claimedAt },
			});

			return candidates.map((c: any) => this.toRecord({ ...c, claimedAt }));
		});
	}

	async markPublished(id: string): Promise<void> {
		await this.model.update({
			where: { id },
			data: { publishedAt: new Date(), claimedAt: null },
		});
	}

	async markFailed(id: string, error: string): Promise<void> {
		await this.model.update({
			where: { id },
			data: {
				attempts: { increment: 1 },
				lastError: error,
				claimedAt: null,
			},
		});
	}

	private toRecord(row: any): OutboxRecord {
		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			createdAt: row.createdAt,
			publishedAt: row.publishedAt ?? undefined,
			attempts: row.attempts,
			lastError: row.lastError ?? undefined,
			correlation:
				row.correlationRequestId ||
				row.correlationCorrelationId ||
				row.correlationTraceId ||
				row.correlationTenantId
					? {
							requestId: row.correlationRequestId ?? undefined,
							correlationId: row.correlationCorrelationId ?? undefined,
							traceId: row.correlationTraceId ?? undefined,
							tenantId: row.correlationTenantId ?? undefined,
						}
					: undefined,
		};
	}
}
