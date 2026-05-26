export interface ShutdownHook {
	/**
	 * A unique name for logging/metrics.
	 */
	name: string;

	/**
	 * Called during graceful shutdown.
	 * Should resolve when the resource is safely closed.
	 */
	shutdown(): Promise<void>;
}

export type ShutdownPhase =
	| "preStopTraffic"
	| "stopTraffic"
	| "infra"
	| "logging";

export interface PrioritizedShutdownHook extends ShutdownHook {
	phase?: ShutdownPhase;
	order?: number; // smaller order runs first within phase
}
