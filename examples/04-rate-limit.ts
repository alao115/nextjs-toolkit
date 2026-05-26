/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 04 — HTTP rate limiting.
 *
 * Shows:
 *  - Wiring `RateLimitModule` with the Redis adapter for multi-instance use.
 *  - Applying the guard globally + per-endpoint cost override.
 *  - Custom key composition.
 *  - RFC 6585 `Retry-After` / `X-RateLimit-Remaining` headers (auto-set).
 */

import { Controller, Get, Module, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
	RateLimit,
	RateLimitGuard,
	RateLimitModule,
	RedisRateLimitAdapter,
} from "@alaska115/nextjs-toolkit/rate-limit";
import type Redis from "ioredis";

declare const redis: Redis;

// ─── Wiring ───────────────────────────────────────────────────────────────

@Module({
	imports: [
		RateLimitModule.forRoot({
			adapter: new RedisRateLimitAdapter({
				client: redis,
				max: 100, // 100 requests per...
				windowMs: 60_000, // ...60s window
				keyPrefix: "rl:",
			}),
		}),
	],
	providers: [
		// Apply globally — every endpoint goes through it unless `@RateLimit({ skip })`.
		{ provide: APP_GUARD, useClass: RateLimitGuard },
	],
})
export class RateLimitExampleModule {}

// ─── Controllers ──────────────────────────────────────────────────────────

@Controller("/api")
export class ApiController {
	// Inherits the 100/60s budget. Default key is
	// `${tenantId ?? "global"}:${userId ?? ip}:${route}`.
	@Get("/cheap")
	cheap() {
		return { ok: true };
	}

	// Costs 5x — burns down the budget faster.
	@RateLimit({ cost: 5 })
	@Post("/expensive")
	expensive() {
		return { ok: true };
	}

	// Custom key — limit by API key header instead of user.
	@RateLimit({
		key: (req) => `apikey:${req.headers["x-api-key"]}`,
	})
	@Post("/webhook")
	webhook() {
		return { ok: true };
	}

	// Exempt — health checks, status endpoints, etc.
	@RateLimit({ skip: true })
	@Get("/health")
	health() {
		return { status: "ok" };
	}
}

// ─── Behavior in production ────────────────────────────────────────────────
//
// On a 200 response:
//   X-RateLimit-Remaining: 87
//
// On a 429 response:
//   X-RateLimit-Remaining: 0
//   Retry-After: 42      (seconds — RFC 6585)
//   { "statusCode": 429, "message": "Too Many Requests" }
//
// Behind a load balancer:
//   - Set `app.set("trust proxy", "loopback, linklocal, uniquelocal")` so
//     `req.ip` resolves to the client IP, not the LB IP.
//   - Otherwise every anonymous user shares a single bucket — easy DoS.
