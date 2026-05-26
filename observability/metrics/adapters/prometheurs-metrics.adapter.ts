import { Injectable } from "@nestjs/common";
// `prom-client` is a CJS module; default-import yields `undefined` under
// strict ESM interop. Use a namespace import so `Registry` / `Counter` /
// `Histogram` / `collectDefaultMetrics` are all reachable from the same
// binding consistently across moduleResolution modes.
import * as client from "prom-client";
import type { Counter, Histogram } from "prom-client";
import {
	CounterMetric,
	HistogramMetric,
	MetricsContract,
} from "../metrics.contract";

class PromCounter implements CounterMetric {
	constructor(private counter: Counter<string>) {}
	inc(labels?: Record<string, string>, value?: number): void {
		if (labels && Object.keys(labels).length) {
			// prom-client expects label object keys exactly matching metric labels used when creating counter
			this.counter.inc(labels as any, value ?? 1);
		} else {
			this.counter.inc(value ?? 1);
		}
	}
}

class PromHistogram implements HistogramMetric {
	constructor(private hist: Histogram<string>) {}
	observe(labels: Record<string, string>, value: number): void {
		if (labels && Object.keys(labels).length) {
			this.hist.observe(labels as any, value);
		} else {
			this.hist.observe(value);
		}
	}
}

@Injectable()
export class PrometheusMetricsAdapter implements MetricsContract {
	private registry: client.Registry;
	private counters = new Map<string, PromCounter>();
	private histograms = new Map<string, PromHistogram>();

	constructor() {
		this.registry = new client.Registry();
		// Optionally collect Node process metrics:
		client.collectDefaultMetrics({ register: this.registry });

		// Add a default label (service) for all metrics
		this.registry.setDefaultLabels({
			service: process.env.SERVICE_NAME ?? "my-service",
			env: process.env.NODE_ENV ?? "development",
		});
	}

	getCounter(name: string): CounterMetric {
		if (!this.counters.has(name)) {
			// Create a counter with labels we expect: method, route, status
			const counter = new client.Counter({
				name,
				help: `${name} counter`,
				// we allow flexible labels — avoid high-cardinality labels by design
				labelNames: [
					"method",
					"route",
					"status",
					"correlationId",
					"traceId",
					"service",
					"env",
				],
				registers: [this.registry],
			});
			this.counters.set(name, new PromCounter(counter));
		}
		return this.counters.get(name)!;
	}

	getHistogram(name: string): HistogramMetric {
		if (!this.histograms.has(name)) {
			const hist = new client.Histogram({
				name,
				help: `${name} histogram`,
				labelNames: [
					"method",
					"route",
					"status",
					"correlationId",
					"traceId",
					"service",
					"env",
				],
				// buckets in seconds; tune as you need
				buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
				registers: [this.registry],
			});
			this.histograms.set(name, new PromHistogram(hist));
		}
		return this.histograms.get(name)!;
	}

	async exportMetrics(): Promise<string> {
		return this.registry.metrics();
	}
}
