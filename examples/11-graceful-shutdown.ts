/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 11 — Graceful shutdown.
 *
 * Shows:
 *  - Phased shutdown (preStopTraffic → stopTraffic → infra → logging).
 *  - Registering custom hooks (queue drain, websocket close, etc).
 *  - Readiness coordination — flip to 503 so the LB drains traffic before
 *    we stop accepting requests.
 *  - The right order for k8s SIGTERM handling.
 */

import { Injectable, OnModuleInit } from "@nestjs/common";
import { ShutdownManager } from "@alaska115/nextjs-toolkit/shutdown";

// ─── Hook registration ───────────────────────────────────────────────────

@Injectable()
export class KafkaProducerHook implements OnModuleInit {
	constructor(private readonly shutdown: ShutdownManager) {}
	declare kafka: { flush(): Promise<void>; disconnect(): Promise<void> };

	onModuleInit() {
		this.shutdown.registerHook({
			name: "kafka-producer",
			phase: "infra",      // run during the infra drain phase
			order: 20,           // after the DB pool (order 10)
			shutdown: async () => {
				await this.kafka.flush();        // send pending records
				await this.kafka.disconnect();   // tear down producer
			},
		});
	}
}

@Injectable()
export class WebSocketHook implements OnModuleInit {
	constructor(private readonly shutdown: ShutdownManager) {}
	declare wss: { close(cb: () => void): void };

	onModuleInit() {
		this.shutdown.registerHook({
			name: "websocket-server",
			phase: "stopTraffic",    // stop accepting NEW connections here
			order: 50,
			shutdown: () => new Promise<void>((resolve) => this.wss.close(resolve)),
		});
	}
}

@Injectable()
export class CacheWarmupTeardown implements OnModuleInit {
	constructor(private readonly shutdown: ShutdownManager) {}
	declare backgroundJobs: { abort(): Promise<void> };

	onModuleInit() {
		this.shutdown.registerHook({
			name: "cache-warmup-jobs",
			phase: "preStopTraffic",  // earliest — cancel background work first
			order: 10,
			shutdown: () => this.backgroundJobs.abort(),
		});
	}
}

// ─── Readiness coordination (already handled by HealthService.readiness) ─
//
// HealthService.readiness() checks ShutdownManager.isShuttingDown() and
// returns 503 while true — Kubernetes drains the pod before the actual
// teardown starts.
//
// If you have a custom readiness endpoint, do the same:

import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";

@Controller("/health")
export class CustomReadinessController {
	constructor(private readonly shutdown: ShutdownManager) {}

	@Get("ready")
	ready() {
		if (this.shutdown.isShuttingDown()) {
			throw new HttpException("Shutting down", HttpStatus.SERVICE_UNAVAILABLE);
		}
		return { status: "ok" };
	}
}

// ─── Bonus: phase order cheat-sheet ──────────────────────────────────────
//
//  Kubernetes sends SIGTERM
//    │
//    ├─ phase 1: preStopTraffic
//    │     – cancel background jobs
//    │     – flip readiness to "down" via Shutdown flag
//    │     – give the load balancer ~5s to drain (sleep in the LB's
//    │       readiness check, not in YOUR shutdown hook)
//    │
//    ├─ phase 2: stopTraffic
//    │     – app.close()                    (HTTP server)
//    │     – wss.close()                    (WebSocket server)
//    │     – queue consumers stop polling
//    │
//    ├─ phase 3: infra
//    │     – await pending DB transactions to finish, then close pool
//    │     – flush outbox / kafka producer
//    │     – close Redis connections
//    │
//    └─ phase 4: logging
//          – flush winston / span exporter / metrics scraper
//          – LAST so previous phases get their final logs out
//
//  process.exit(0)
//
// If anything in this chain hangs >30s, Kubernetes sends SIGKILL. The
// package's hooks have no internal timeout — wrap slow drains in
// `withTimeout()` from @alaska115/nextjs-toolkit/resilience.
