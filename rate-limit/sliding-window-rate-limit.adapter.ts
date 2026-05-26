import { Injectable } from "@nestjs/common";
import {
	RateLimitContract,
	RateLimitDecision,
} from "./rate-limit.contract";

export interface SlidingWindowConfig {
	max: number;
	windowMs: number;
}

/**
 * Sliding-window rate limiter. Tracks individual request timestamps per key
 * and counts how many fall within the trailing `windowMs`. This eliminates
 * the burst-at-window-edge problem of fixed-window limiters at the cost of
 * O(requests/key) memory.
 *
 * In-process only. For multi-instance use, port the same algorithm to Redis
 * with a sorted set (`ZADD` / `ZREMRANGEBYSCORE` / `ZCARD`).
 */
@Injectable()
export class SlidingWindowRateLimitAdapter implements RateLimitContract {
	private readonly hits = new Map<string, number[]>();

	constructor(private readonly cfg: SlidingWindowConfig) {}

	async consume(key: string, cost = 1): Promise<RateLimitDecision> {
		const now = Date.now();
		const windowStart = now - this.cfg.windowMs;

		const bucket = this.hits.get(key) ?? [];
		// Drop hits older than the window in-place.
		let firstFresh = 0;
		while (firstFresh < bucket.length && bucket[firstFresh] < windowStart) {
			firstFresh++;
		}
		const fresh = firstFresh > 0 ? bucket.slice(firstFresh) : bucket;

		if (fresh.length + cost > this.cfg.max) {
			const oldest = fresh[0] ?? now;
			this.hits.set(key, fresh);
			return {
				allowed: false,
				remaining: Math.max(0, this.cfg.max - fresh.length),
				retryAfterMs: Math.max(1, oldest + this.cfg.windowMs - now),
			};
		}

		for (let i = 0; i < cost; i++) fresh.push(now);
		this.hits.set(key, fresh);
		return { allowed: true, remaining: this.cfg.max - fresh.length };
	}
}
