// src/observability/metrics/default-metrics.adapter.ts
import { Injectable } from "@nestjs/common";
import {
	CounterMetric,
	HistogramMetric,
	MetricsContract,
} from "../metrics.contract";

class NoopCounter implements CounterMetric {
	inc(_labels?: Record<string, string>, _value?: number): void {
		/* noop */
	}
}

class NoopHistogram implements HistogramMetric {
	observe(_labels: Record<string, string>, _value: number): void {
		/* noop */
	}
}

@Injectable()
export class DefaultNoopMetricsAdapter implements MetricsContract {
	private counters = new Map<string, CounterMetric>();
	private histograms = new Map<string, HistogramMetric>();

	getCounter(name: string): CounterMetric {
		if (!this.counters.has(name)) {
			this.counters.set(name, new NoopCounter());
		}
		return this.counters.get(name)!;
	}

	getHistogram(name: string): HistogramMetric {
		if (!this.histograms.has(name)) {
			this.histograms.set(name, new NoopHistogram());
		}
		return this.histograms.get(name)!;
	}

	async exportMetrics(): Promise<string> {
		return "# no metrics adapter configured\n";
	}
}
