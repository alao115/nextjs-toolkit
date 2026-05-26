import { Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import {
	RateLimitContract,
	RateLimitDecision,
} from "./rate-limit.contract";

export interface RedisRateLimitConfig {
	/** ioredis client instance. */
	client: Redis;
	/** Max tokens per `windowMs` per key. */
	max: number;
	/** Window size in milliseconds (used as the Redis key TTL). */
	windowMs: number;
	/** Prefix for Redis keys to avoid collision across services. Default: `rl:`. */
	keyPrefix?: string;
}

/**
 * Redis-backed rate limiter. Uses an atomic Lua script so concurrent
 * requests across instances cannot race past the limit.
 *
 * The script is sent on each call — ioredis caches it server-side via
 * EVALSHA so the wire cost is just the SHA1 + args.
 *
 * Algorithm: per-key counter with PEXPIRE on first increment. When the
 * window expires, Redis evicts the key and the counter resets.
 */
@Injectable()
export class RedisRateLimitAdapter implements RateLimitContract {
	private readonly script: string;

	constructor(private readonly cfg: RedisRateLimitConfig) {
		this.script = `
local current = redis.call('INCRBY', KEYS[1], ARGV[1])
if current == tonumber(ARGV[1]) then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;
	}

	async consume(key: string, cost = 1): Promise<RateLimitDecision> {
		const prefix = this.cfg.keyPrefix ?? "rl:";
		const fullKey = `${prefix}${key}`;
		const result = (await this.cfg.client.eval(
			this.script,
			1,
			fullKey,
			String(cost),
			String(this.cfg.windowMs),
		)) as [number, number];

		const [current, ttl] = result;
		const remaining = Math.max(0, this.cfg.max - current);

		if (current > this.cfg.max) {
			return {
				allowed: false,
				remaining,
				retryAfterMs: ttl > 0 ? ttl : this.cfg.windowMs,
			};
		}
		return { allowed: true, remaining };
	}
}
