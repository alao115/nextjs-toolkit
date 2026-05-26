import type Redis from "ioredis";
import { CircuitOpenError, CircuitState } from "./circuit-breaker";

export interface RedisCircuitBreakerOptions {
	/** ioredis client. */
	client: Redis;
	/** Unique name for this breaker — used in the Redis key. */
	name: string;
	/** Failures within the rolling window that trip the breaker. Default: 5. */
	failureThreshold?: number;
	/** Milliseconds the breaker stays open. Default: 30s. */
	resetTimeoutMs?: number;
	/** Successful half-open probes required to close. Default: 2. */
	halfOpenSuccessThreshold?: number;
	/** Redis key prefix. Default: `cb:`. */
	keyPrefix?: string;
}

const DEFAULTS = {
	failureThreshold: 5,
	resetTimeoutMs: 30_000,
	halfOpenSuccessThreshold: 2,
	keyPrefix: "cb:",
};

/**
 * Distributed circuit breaker backed by Redis. State (failure count, open/half-open
 * timestamp, half-open success count) lives in a single hash per breaker name,
 * shared across all process instances. State transitions are atomic via Lua so
 * two pods can't both flip the breaker into inconsistent states.
 *
 * **Failure mode**: if Redis is unreachable, the breaker "fails open" — calls
 * are allowed through. This matches the principle of least surprise (you don't
 * want your control plane being down to *cause* outages), but consumers who
 * want fail-closed should wrap `run()` with their own check.
 */
export class RedisCircuitBreaker {
	private readonly opts: typeof DEFAULTS;
	private readonly key: string;
	private readonly stateScript: string;
	private readonly recordScript: string;

	constructor(private readonly cfg: RedisCircuitBreakerOptions) {
		this.opts = {
			failureThreshold: cfg.failureThreshold ?? DEFAULTS.failureThreshold,
			resetTimeoutMs: cfg.resetTimeoutMs ?? DEFAULTS.resetTimeoutMs,
			halfOpenSuccessThreshold:
				cfg.halfOpenSuccessThreshold ?? DEFAULTS.halfOpenSuccessThreshold,
			keyPrefix: cfg.keyPrefix ?? DEFAULTS.keyPrefix,
		};
		this.key = `${this.opts.keyPrefix}${cfg.name}`;

		// Lua: read current state, transition open→half-open if reset window elapsed,
		// and return ("closed" | "open" | "half-open"). All atomic.
		this.stateScript = `
local state = redis.call('HGET', KEYS[1], 'state') or 'closed'
local openedAt = tonumber(redis.call('HGET', KEYS[1], 'openedAt') or '0')
local now = tonumber(ARGV[1])
local resetTimeoutMs = tonumber(ARGV[2])
if state == 'open' and (now - openedAt) >= resetTimeoutMs then
  redis.call('HSET', KEYS[1], 'state', 'half-open', 'halfOpenSuccesses', 0)
  return 'half-open'
end
return state
`;

		// Lua: record success/failure outcome and transition state if needed.
		// ARGV: now, outcome(0=fail,1=success), failureThreshold, halfOpenSuccessThreshold
		this.recordScript = `
local state = redis.call('HGET', KEYS[1], 'state') or 'closed'
local now = tonumber(ARGV[1])
local success = tonumber(ARGV[2])
local failureThreshold = tonumber(ARGV[3])
local halfOpenThreshold = tonumber(ARGV[4])

if success == 1 then
  if state == 'half-open' then
    local n = redis.call('HINCRBY', KEYS[1], 'halfOpenSuccesses', 1)
    if n >= halfOpenThreshold then
      redis.call('HSET', KEYS[1], 'state', 'closed', 'failures', 0, 'halfOpenSuccesses', 0)
      return 'closed'
    end
    return 'half-open'
  end
  redis.call('HSET', KEYS[1], 'failures', 0)
  return 'closed'
end

-- failure path
if state == 'half-open' then
  redis.call('HSET', KEYS[1], 'state', 'open', 'openedAt', now, 'halfOpenSuccesses', 0)
  return 'open'
end

local f = redis.call('HINCRBY', KEYS[1], 'failures', 1)
if f >= failureThreshold then
  redis.call('HSET', KEYS[1], 'state', 'open', 'openedAt', now)
  return 'open'
end
return state
`;
	}

	async getState(): Promise<CircuitState> {
		try {
			const result = (await this.cfg.client.eval(
				this.stateScript,
				1,
				this.key,
				String(Date.now()),
				String(this.opts.resetTimeoutMs),
			)) as string;
			return result as CircuitState;
		} catch {
			return "closed";
		}
	}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		const state = await this.getState();
		if (state === "open") {
			throw new CircuitOpenError(this.cfg.name);
		}
		try {
			const result = await fn();
			await this.record(true);
			return result;
		} catch (err) {
			await this.record(false);
			throw err;
		}
	}

	private async record(success: boolean): Promise<void> {
		try {
			await this.cfg.client.eval(
				this.recordScript,
				1,
				this.key,
				String(Date.now()),
				success ? "1" : "0",
				String(this.opts.failureThreshold),
				String(this.opts.halfOpenSuccessThreshold),
			);
		} catch {
			// Fail open: if Redis is unreachable, don't punish the caller.
		}
	}
}
