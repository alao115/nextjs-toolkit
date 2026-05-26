export interface RateLimitDecision {
	allowed: boolean;
	remaining: number;
	retryAfterMs?: number;
}

export interface RateLimitContract {
	/**
	 * Consume `cost` tokens (default 1) under `key` against the configured
	 * limit. Returns whether the request is allowed plus headroom info.
	 */
	consume(key: string, cost?: number): Promise<RateLimitDecision>;
}

export const RATE_LIMIT_PORT = Symbol("RATE_LIMIT_PORT");
