import {
	Injectable,
	OnModuleInit,
	OnModuleDestroy,
	Inject,
} from "@nestjs/common";
import { PrioritizedShutdownHook, ShutdownPhase } from "./shutdown.types";
import { LoggerService } from "../observability/logger/logger.service";

@Injectable()
export class ShutdownManager implements OnModuleInit, OnModuleDestroy {
	@Inject(LoggerService)
	private readonly logger: LoggerService;
	private readonly hooks: PrioritizedShutdownHook[] = [];
	private signalsBound = false;
	private shuttingDown = false;

	onModuleInit() {
		this.bindProcessSignals();
	}

	onModuleDestroy() {
		// Optional: run shutdown when Nest calls module destroy
		// but usually you'll trigger this via process signals
	}

	registerHook(hook: PrioritizedShutdownHook) {
		this.logger.info(`Registering shutdown hook: ${hook.name}`);
		this.hooks.push({
			phase: "infra",
			order: 100,
			...hook,
		});
	}

	private bindProcessSignals() {
		if (this.signalsBound) return;
		this.signalsBound = true;

		const handleSignal = async (signal: NodeJS.Signals) => {
			if (this.shuttingDown) {
				this.logger.warn(`Received ${signal} while already shutting down.`);
				return;
			}
			this.shuttingDown = true;

			this.logger.warn(`Received ${signal}, starting graceful shutdown...`);
			try {
				await this.shutdown();
				this.logger.info("Graceful shutdown completed. Exiting with code 0.");
				process.exit(0);
			} catch (err) {
				this.logger.error(
					"Graceful shutdown failed, exiting with code 1.",
					err as Error,
				);
				process.exit(1);
			}
		};

		process.on("SIGTERM", handleSignal);
		process.on("SIGINT", handleSignal);
	}

	async shutdown() {
		const phases: ShutdownPhase[] = [
			"preStopTraffic",
			"stopTraffic",
			"infra",
			"logging",
		];

		for (const phase of phases) {
			const hooksInPhase = this.hooks
				.filter((h) => h.phase === phase)
				.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

			if (!hooksInPhase.length) continue;

			this.logger.info(
				`Running shutdown phase: ${phase} (${hooksInPhase.length} hooks)`,
			);

			for (const hook of hooksInPhase) {
				this.logger.info(`Shutting down [${phase}] hook: ${hook.name}`);
				try {
					await hook.shutdown();
					this.logger.info(`Hook completed: ${hook.name}`);
				} catch (err) {
					this.logger.error(`Hook failed: ${hook.name}`, (err as any).stack);
					// don't stop other hooks — we keep trying
				}
			}
		}
	}

	isShuttingDown() {
		return this.shuttingDown;
	}
}
