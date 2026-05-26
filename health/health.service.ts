import { Injectable, Inject, Logger } from "@nestjs/common";
import { HealthIndicator } from "./health-indicator.interface";
import { HEALTH_INDICATORS } from "./health.constants";
import { ShutdownManager } from "../shutdown/shutdown.manager";

export type OverallStatus = "ok" | "degraded" | "down";

export interface HealthStatus {
	status: OverallStatus;
	details: Record<string, { status: "up" | "down"; info?: any }>;
}

@Injectable()
export class HealthService {
	private readonly logger = new Logger(HealthService.name);

	constructor(
		@Inject(HEALTH_INDICATORS)
		private readonly indicators: HealthIndicator[],
		private readonly shutdownManager: ShutdownManager,
	) {}

	async checkAll(): Promise<HealthStatus> {
		const details: HealthStatus["details"] = {};
		let anyDown = false;

		for (const indicator of this.indicators) {
			try {
				const result = await indicator.check();
				details[result.name] = { status: result.status, info: result.info };
				if (result.status === "down") {
					anyDown = true;
				}
			} catch (e) {
				anyDown = true;
				const error = e as Error;
				this.logger.error(
					`Health indicator "${indicator.name}" failed`,
					error.stack,
				);
				details[indicator.name] = {
					status: "down",
					info: { error: error.message },
				};
			}
		}

		const status: OverallStatus = anyDown ? "degraded" : "ok";

		return { status, details };
	}

	async readiness(): Promise<HealthStatus> {
		if (this.shutdownManager.isShuttingDown()) {
			return {
				status: "down",
				details: {
					draining: { status: "down", info: { message: "Instance draining" } },
				},
			};
		}
		return this.checkAll();
	}

	// Optionally, just a “service is alive” (no external deps)
	async liveness(): Promise<HealthStatus> {
		return { status: "ok", details: {} };
	}
}
