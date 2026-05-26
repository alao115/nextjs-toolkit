import { Injectable, Optional } from "@nestjs/common";
import { CounterMetric, HistogramMetric } from "./metrics.contract";
import { MetricsContract } from "./metrics.contract";
import { RequestContextService } from "../../context/request-context.service";

@Injectable()
export class MetricsService {
	constructor(
		private readonly ctxService: RequestContextService,
		@Optional()
		private readonly metricsPort?: MetricsContract,
	) {}

	private withCtxLabels(
		labels: Record<string, string> = {},
	): Record<string, string> {
		const ctx = this.ctxService.getContext();
		return {
			...labels,
			traceId: ctx?.traceId ?? "",
			correlationId: ctx?.correlationId ?? "",
			// avoid userId in labels by default (cardinality)
		};
	}

	counter(name: string): CounterMetric {
		if (!this.metricsPort) {
			return { inc: () => {} };
		}
		return this.metricsPort.getCounter(name);
	}

	histogram(name: string): HistogramMetric {
		if (!this.metricsPort) {
			return { observe: () => {} };
		}
		return this.metricsPort.getHistogram(name);
	}

	// helpers for HTTP metrics

	httpRequestCounter(): CounterMetric {
		return this.counter("http_requests_total");
	}

	httpRequestDuration(): HistogramMetric {
		return this.histogram("http_request_duration_ms");
	}

	withContextLabels(labels: Record<string, string>): Record<string, string> {
		return this.withCtxLabels(labels);
	}

	async export(): Promise<string> {
		if (!this.metricsPort?.exportMetrics) {
			return "# metrics export not implemented\n";
		}
		return this.metricsPort.exportMetrics();
	}
}
