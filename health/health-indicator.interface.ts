export type HealthIndicatorStatus = "up" | "down";

export interface HealthIndicatorResult {
	name: string;
	status: HealthIndicatorStatus;
	info?: any;
}

export interface HealthIndicator {
	/**
	 * A unique name for the indicator: 'db', 'redis', 'rmq', etc.
	 */
	name: string;

	/**
	 * Performs a health check. Throw if critical, or return 'down'.
	 */
	check(): Promise<HealthIndicatorResult>;
}
