import { Injectable } from "@nestjs/common";
import {
	RateLimitContract,
	RateLimitDecision,
} from "./rate-limit.contract";

export interface InMemoryRateLimitConfig {
	/** Max tokens per `windowMs` per key. */
	max: number;
	/** Window size in milliseconds. */
	windowMs: number;
}

/**
 * Token-bucket-ish in-memory rate limiter — suitable for a single process.
 * For multi-instance deployments, use a Redis-backed adapter (the consumer
 * provides their own implementation of {@link RateLimitContract}).
 */
@Injectable()
export class InMemoryRateLimitAdapter implements RateLimitContract {
	private readonly buckets = new Map<
		string,
		{ count: number; resetAt: number }
	>();

	constructor(private readonly cfg: InMemoryRateLimitConfig) {}

	async consume(key: string, cost = 1): Promise<RateLimitDecision> {
		const now = Date.now();
		const bucket = this.buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			this.buckets.set(key, { count: cost, resetAt: now + this.cfg.windowMs });
			return { allowed: cost <= this.cfg.max, remaining: this.cfg.max - cost };
		}
		if (bucket.count + cost > this.cfg.max) {
			return {
				allowed: false,
				remaining: Math.max(0, this.cfg.max - bucket.count),
				retryAfterMs: bucket.resetAt - now,
			};
		}
		bucket.count += cost;
		return { allowed: true, remaining: this.cfg.max - bucket.count };
	}
}
