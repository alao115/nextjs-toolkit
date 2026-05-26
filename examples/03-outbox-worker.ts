/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 03 — Transactional outbox with a Kafka subscriber.
 *
 * Shows:
 *  - Writing business state + outbox record in the SAME transaction.
 *  - Configuring the worker with per-type subscribers, max-attempts, DLQ.
 *  - Graceful shutdown integration (worker stops cleanly on SIGTERM).
 */

import { Inject, Injectable, Module, OnModuleInit } from "@nestjs/common";
import {
	OUTBOX_PORT,
	OutboxContract,
	OutboxModule,
	OutboxWorker,
	PrismaOutboxAdapter,
} from "@alaska115/nextjs-toolkit/outbox";

// Hand-waving deps — bring your own.
declare const prisma: any;
declare const kafka: { publish(payload: unknown): Promise<void> };
declare const dlqStore: { save(record: unknown): Promise<void> };

// ─── Wiring ───────────────────────────────────────────────────────────────

@Module({
	imports: [
		OutboxModule.forRoot({
			adapter: new PrismaOutboxAdapter({
				prisma,
				modelName: "outboxEvent",
				// Records claimed >5 min ago whose worker crashed get reclaimed.
				staleClaimAfterMs: 5 * 60_000,
			}),
		}),
	],
	providers: [OutboxWorker],
	exports: [OutboxWorker],
})
export class OutboxExampleModule {}

// ─── Producer: write business state + outbox in one transaction ──────────

@Injectable()
export class OrderService {
	constructor(@Inject(OUTBOX_PORT) private readonly outbox: OutboxContract) {}

	async placeOrder(userId: string, items: unknown[]): Promise<string> {
		// The whole thing in one tx: if `outbox.enqueue` fails OR the kafka
		// publish later fails, we either don't have an order, or we have an
		// order that will eventually be published. Never the inconsistent
		// "order created, downstream never knew" case.
		return prisma.$transaction(async (tx: any) => {
			const order = await tx.order.create({
				data: { userId, items, status: "PLACED" },
			});

			// IMPORTANT: when using a wrapped tx context, you'd construct an
			// adapter bound to `tx` here. For brevity we use the global one;
			// some setups inject a `Transactional` decorator that does this.
			await this.outbox.enqueue({
				type: "order.placed",
				payload: { orderId: order.id, userId, items },
			});

			return order.id;
		});
	}
}

// ─── Worker: drain the outbox to Kafka ────────────────────────────────────

@Injectable()
export class OutboxBootstrap implements OnModuleInit {
	constructor(private readonly worker: OutboxWorker) {}

	onModuleInit(): void {
		this.worker.configure({
			pollIntervalMs: 500,
			busyPollIntervalMs: 25,
			batchSize: 100,
			maxAttempts: 10,
			subscribers: {
				"order.placed": async (record) => {
					await kafka.publish({
						topic: "orders.events",
						key: (record.payload as any).orderId,
						value: record.payload,
						headers: {
							"x-event-type": record.type,
							"x-correlation-id":
								record.correlation?.correlationId ?? "",
							"x-tenant-id": record.correlation?.tenantId ?? "",
						},
					});
				},
				"user.signed-up": async (record) => {
					await kafka.publish({
						topic: "user.events",
						value: record.payload,
					});
				},
				"*": async (record) => {
					// Catch-all — fail soft and let attempts climb.
					throw new Error(`No subscriber for ${record.type}`);
				},
			},
			deadLetterHandler: async (record) => {
				// Stash in a separate table for ops to inspect.
				await dlqStore.save(record);
			},
		});

		this.worker.start();
		// `OutboxWorker` registers its own shutdown hook so SIGTERM
		// finishes the in-flight batch.
	}
}
