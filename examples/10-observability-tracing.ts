/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 10 — Observability: structured logs, traces, metrics.
 *
 * Shows:
 *  - The canonical LogEvent shape vs. the loose meta-bag API.
 *  - Spans with attributes + events for fine-grained debugging.
 *  - Avoiding high-cardinality metric labels.
 *  - The "trace through async boundary" pattern (ALS handles it for you).
 */

import { Injectable } from "@nestjs/common";
import {
	LoggerService,
	TracingService,
	MetricsService,
} from "@alaska115/nextjs-toolkit/observability";

@Injectable()
export class OrderService {
	constructor(
		private readonly logger: LoggerService,
		private readonly tracing: TracingService,
		private readonly metrics: MetricsService,
	) {}

	// ─── Structured logging (canonical shape, RECOMMENDED) ───────────────
	async placeOrder(input: { userId: string; tenantId: string; items: unknown[] }) {
		// `logger.event` enforces the LogEvent shape — your log shipper
		// (ELK / Datadog / GCP) gets predictable field names.
		this.logger.event({
			severity: "info",
			message: "order.placed",
			userId: input.userId,
			tenantId: input.tenantId,
			attributes: {
				itemCount: input.items.length,
			},
		});
		// `requestId`, `correlationId`, `traceId` are auto-filled from the
		// active RequestContext — you don't pass them.
	}

	// ─── Loose form (fine for ad-hoc logs) ───────────────────────────────
	logInteresting() {
		this.logger.info("something happened", { extra: "data" });
		// Also auto-enriches with context IDs.
	}

	// ─── Tracing ─────────────────────────────────────────────────────────
	async chargeCard(amount: number, currency: string): Promise<string> {
		return this.tracing.runInSpan("orders.chargeCard", async (span) => {
			span.setAttribute("payment.amount", amount);
			span.setAttribute("payment.currency", currency);

			// Mark named moments inside a long-running span.
			span.addEvent?.("authorize.start");
			const authToken = await this.gateway.authorize(amount, currency);
			span.addEvent?.("authorize.done");

			span.addEvent?.("capture.start");
			const txId = await this.gateway.capture(authToken);
			span.addEvent?.("capture.done");

			return txId;
		});
	}

	// ─── Metrics: BE CAREFUL WITH LABEL CARDINALITY ──────────────────────

	// ✅ DO: low-cardinality labels
	private readonly orderCounter = this.metrics.getCounter("orders_created_total");
	private readonly orderHistogram = this.metrics.getHistogram("orders_create_duration_seconds");

	async recordOrder(tenantId: string, status: "ok" | "failed") {
		this.orderCounter.inc({ tenant: tenantId, status });
		// "tenant" has hundreds of values — fine.
		// "status" has 2 — fine.
	}

	// ❌ DON'T: high-cardinality labels
	wrongRecord(orderId: string) {
		// One time-series per order = millions. This is what kills Prometheus.
		this.orderCounter.inc({ orderId } as any);
	}

	// ─── Latency histogram ──────────────────────────────────────────────
	async slowOp() {
		const stop = this.orderHistogram.startTimer({});
		try {
			await this.actuallyDoTheThing();
		} finally {
			stop();
		}
	}

	declare gateway: any;
	declare actuallyDoTheThing: () => Promise<void>;
}

// ─── Bonus: tracing the entire HTTP request ─────────────────────────────
//
// ObservabilityModule.forRoot({ tracing: true }) registers the
// `TracingInterceptor` which wraps every controller handler in a span
// named like "POST /orders". Your custom `runInSpan` calls become child
// spans of that root — the trace tree builds itself.
//
// What you should NOT do is start spans inside Prisma middleware or
// repository hot paths. Span creation is cheap-ish but not free; one span
// per logical operation, not per SQL statement.
