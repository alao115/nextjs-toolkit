/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 06 — Resilience primitives.
 *
 * Shows the canonical "wrap every remote call" pattern, plus deadline
 * propagation across a fan-out, plus distributed circuit breaker.
 */

import {
	Bulkhead,
	CircuitBreaker,
	RedisCircuitBreaker,
	getRemainingBudget,
	retry,
	withDeadline,
	withRemainingBudget,
	withTimeout,
} from "@alaska115/nextjs-toolkit/resilience";
import type Redis from "ioredis";

declare const httpClient: { get(path: string): Promise<any> };
declare const redis: Redis;

// ─── A single remote call ────────────────────────────────────────────────

export async function fetchUser(id: string): Promise<unknown> {
	// Defense in depth: timeout, then retry only on transient failures.
	return retry(
		() => withTimeout(httpClient.get(`/users/${id}`), 2000, "users.get"),
		{
			maxRetries: 3,
			baseBackoffMs: 200,
			maxBackoffMs: 2000,
			jitterMs: 100,
			// Only retry network errors and 5xx — never 4xx (which are
			// our fault, not a transient backend hiccup).
			shouldRetry: (err: any) => {
				if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") return true;
				const status = err.response?.status ?? err.status;
				return status >= 500 && status < 600;
			},
		},
	);
	// If the error has a `Retry-After` header / `.retryAfterMs` field,
	// `retry()` honors it and skips exponential backoff for that attempt.
}

// ─── A fan-out under a hard budget ───────────────────────────────────────

export async function getUserDashboard(
	userId: string,
): Promise<{ user: unknown; prefs: unknown; activity: unknown }> {
	// Total wall-clock cap: 500ms. Children inherit `min(parent, requested)`.
	return withDeadline(500, async () => {
		const user = await withRemainingBudget(200, () =>
			httpClient.get(`/users/${userId}`),
		);

		// You can check how much budget is left before kicking off
		// a non-critical call.
		if ((getRemainingBudget() ?? 0) < 100) {
			return { user, prefs: null, activity: null };
		}

		const [prefs, activity] = await Promise.all([
			withRemainingBudget(150, () => httpClient.get(`/users/${userId}/prefs`)),
			withRemainingBudget(150, () => httpClient.get(`/users/${userId}/activity`)),
		]);

		return { user, prefs, activity };
	});
}

// ─── Per-dependency bulkhead + breaker ────────────────────────────────────

const searchBulkhead = new Bulkhead("search", {
	maxConcurrent: 20,
	maxQueueSize: 50,
});

// Per-instance breaker — simple, single-pod scope.
const localSearchBreaker = new CircuitBreaker("search", {
	failureThreshold: 5,
	resetTimeoutMs: 30_000,
});

// Distributed breaker — shared state across all pods via Redis.
const fleetSearchBreaker = new RedisCircuitBreaker({
	client: redis,
	name: "search",
	failureThreshold: 5,
	resetTimeoutMs: 30_000,
});

export async function search(q: string): Promise<unknown[]> {
	// Layer order matters:
	//   bulkhead   — first, so a tripped breaker doesn't pile up in the queue
	//   breaker    — second, fail-fast when the dependency is sick
	//   timeout    — third, the actual remote call's leaf timeout
	return searchBulkhead.run(() =>
		fleetSearchBreaker.run(() =>
			withTimeout(httpClient.get(`/search?q=${q}`), 1500, "search"),
		),
	);
}

// Inspect bulkhead state (useful for /metrics)
export function searchPressureMetrics() {
	return {
		inFlight: searchBulkhead.getInFlight(),
		queued: searchBulkhead.getQueueLength(),
		breakerState: localSearchBreaker.getState(),
	};
}
