export interface CounterMetric {
	inc(labels?: Record<string, string>, value?: number): void;
}

export interface HistogramMetric {
	observe(labels: Record<string, string>, value: number): void;
}

export interface MetricsContract {
	getCounter(name: string): CounterMetric;
	getHistogram(name: string): HistogramMetric;

	// Optional: called by /metrics endpoint if there is one
	exportMetrics?(): Promise<string> | string;
}

export const METRICS_PORT = Symbol("METRICS_PORT");
