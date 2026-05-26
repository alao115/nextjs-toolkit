import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { OUTBOX_PORT, OutboxContract, OutboxRecord } from "./outbox.contract";
import { LoggerService } from "../observability/logger/logger.service";
import { ShutdownManager } from "../shutdown/shutdown.manager";

/**
 * A handler decides how to publish a single outbox record. Throw to mark
 * the record as failed; resolve to mark it published.
 */
export type OutboxSubscriber = (record: OutboxRecord) => Promise<void>;

export interface OutboxWorkerConfig {
	/** Milliseconds between polls when the queue is empty. Default: 1000. */
	pollIntervalMs?: number;
	/** Milliseconds between polls when the last batch had work. Default: 50. */
	busyPollIntervalMs?: number;
	/** Maximum records claimed per poll. Default: 50. */
	batchSize?: number;
	/** Max delivery attempts before sending to DLQ. Default: 10. */
	maxAttempts?: number;
	/** Subscribers keyed by record `type` (use `"*"` as catch-all). */
	subscribers: Record<string, OutboxSubscriber>;
	/** Called with records that exceed `maxAttempts`. Default: log + drop. */
	deadLetterHandler?: (record: OutboxRecord) => Promise<void> | void;
}

/**
 * Generic outbox worker. Loops while the process is alive, claiming pending
 * records and dispatching them to subscribers keyed by `record.type`.
 *
 * Wires itself into {@link ShutdownManager} so an in-flight batch finishes
 * before the process exits.
 */
@Injectable()
export class OutboxWorker implements OnModuleInit {
	private running = false;
	private stopRequested = false;
	private loopPromise?: Promise<void>;

	constructor(
		@Optional() @Inject(OUTBOX_PORT) private readonly outbox: OutboxContract | null,
		private readonly logger: LoggerService,
		@Optional() private readonly shutdownManager?: ShutdownManager,
	) {}

	private cfg: Required<Omit<OutboxWorkerConfig, "deadLetterHandler">> & {
		deadLetterHandler: (record: OutboxRecord) => Promise<void> | void;
	} = {
		pollIntervalMs: 1000,
		busyPollIntervalMs: 50,
		batchSize: 50,
		maxAttempts: 10,
		subscribers: {},
		deadLetterHandler: (record) => {
			this.logger.error(
				`[outbox] record ${record.id} exceeded ${this.cfg.maxAttempts} attempts — dropped`,
				{ record },
			);
		},
	};

	/**
	 * Configure the worker. Must be called before `start()`.
	 */
	configure(config: OutboxWorkerConfig): this {
		this.cfg = {
			...this.cfg,
			...config,
			deadLetterHandler: config.deadLetterHandler ?? this.cfg.deadLetterHandler,
		};
		return this;
	}

	onModuleInit() {
		this.shutdownManager?.registerHook({
			name: "outbox-worker",
			phase: "infra",
			order: 20,
			shutdown: async () => {
				this.stop();
				if (this.loopPromise) await this.loopPromise;
			},
		});
	}

	/**
	 * Start the polling loop. Returns immediately. If already running, no-op.
	 */
	start(): void {
		if (this.running || !this.outbox) return;
		this.running = true;
		this.stopRequested = false;
		this.loopPromise = this.loop();
	}

	stop(): void {
		this.stopRequested = true;
	}

	isRunning(): boolean {
		return this.running;
	}

	private async loop(): Promise<void> {
		while (!this.stopRequested) {
			try {
				const records = await this.outbox!.claimPending(this.cfg.batchSize);
				if (records.length === 0) {
					await this.sleep(this.cfg.pollIntervalMs);
					continue;
				}
				await Promise.all(records.map((r) => this.dispatch(r)));
				await this.sleep(this.cfg.busyPollIntervalMs);
			} catch (err) {
				this.logger.error("[outbox] poll loop error", { error: err });
				await this.sleep(this.cfg.pollIntervalMs);
			}
		}
		this.running = false;
	}

	private async dispatch(record: OutboxRecord): Promise<void> {
		const handler =
			this.cfg.subscribers[record.type] ?? this.cfg.subscribers["*"];
		if (!handler) {
			await this.outbox!.markFailed(
				record.id,
				`No subscriber registered for type "${record.type}"`,
			);
			return;
		}
		try {
			await handler(record);
			await this.outbox!.markPublished(record.id);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			await this.outbox!.markFailed(record.id, errorMessage);
			if (record.attempts + 1 >= this.cfg.maxAttempts) {
				await this.cfg.deadLetterHandler({
					...record,
					attempts: record.attempts + 1,
					lastError: errorMessage,
				});
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
