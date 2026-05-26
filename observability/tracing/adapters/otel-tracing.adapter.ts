import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	diag,
	DiagConsoleLogger,
	DiagLogLevel,
	trace,
	context,
	SpanKind,
	SpanStatusCode,
} from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { TracingContract, TracingSpan } from "../tracing.contract";
import { ConfigService } from "@nestjs/config";
import { ShutdownManager } from "../../../shutdown/shutdown.manager";

// enable diag logs in dev if needed
if (process.env.OTEL_DEBUG === "true") {
	diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

@Injectable()
export class OtelTracingAdapter
	implements TracingContract, OnModuleInit, OnModuleDestroy
{
	private sdk?: NodeSDK;
	constructor(
		private readonly configService: ConfigService,
		private readonly shutdownManager: ShutdownManager,
	) {}

	async onModuleInit() {
		// configure exporter
		const otlpEndpoint = process.env.OTLP_ENDPOINT; // e.g. http://collector:4318/v1/traces
		const exporter = otlpEndpoint
			? new OTLPTraceExporter({
					url: otlpEndpoint,
				})
			: undefined;

		// NodeSDK accepts undefined exporter; if none, sdk still starts with noop exporter if not provided
		this.sdk = new NodeSDK({
			resource: resourceFromAttributes({
				[ATTR_SERVICE_NAME]: this.configService.get("app.name"),
				[ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? "0.0.1",
			}),
			traceExporter: exporter,
			instrumentations: [
				new HttpInstrumentation(),
				new ExpressInstrumentation(),
			] as Instrumentation[],
		});

		await this.sdk.start();

		this.shutdownManager.registerHook({
			name: "otel-tracer",
			phase: "logging",
			order: 10,
			shutdown: async () => {
				const tracerProvider = trace.getTracerProvider();
				// depends on your setup; usually you do provider.shutdown()
				if ((tracerProvider as any).shutdown) {
					await (tracerProvider as any).shutdown();
				}
			},
		});
	}

	startSpan(name: string, attributes: Record<string, any> = {}): TracingSpan {
		const tracer = trace.getTracer(
			process.env.SERVICE_NAME ?? "my-service-tracer",
		);
		const ctxActive = context.active();

		const span = tracer.startSpan(
			name,
			{
				attributes,
				kind: SpanKind.INTERNAL,
			},
			ctxActive,
		);

		return {
			end: (err?: Error) => {
				if (err) {
					span.recordException(err);
					span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
				} else {
					span.setStatus({ code: SpanStatusCode.UNSET });
				}
				span.end();
			},
			setAttribute: (key: string, value: string | number | boolean): void => {
				span.setAttribute(key, value as any);
			},
			setAttributes(attrs: Record<string, string | number | boolean>): void {
				for (const [k, v] of Object.entries(attrs)) {
					this.span.setAttribute(k, v as any);
				}
			},
			recordException(error: Error): void {
				this.span.recordException(error);
			},
		};
	}

	runInSpan<T>(
		name: string,
		fn: (span: TracingSpan) => T | Promise<T>,
		attributes: Record<string, any> = {},
	): T | Promise<T> {
		const tracer = trace.getTracer(
			process.env.SERVICE_NAME ?? "my-service-tracer",
		);
		// use context.with to ensure child spans work correctly
		return tracer.startActiveSpan(name, { attributes }, async (span) => {
			try {
				const result = fn(span as any);
				if (result instanceof Promise) {
					return result
						.then((r) => {
							span.end();
							return r;
						})
						.catch((err) => {
							span.recordException(err);
							span.setStatus({
								code: SpanStatusCode.ERROR,
								message: err.message,
							});
							span.end();
							throw err;
						});
				} else {
					span.end();
					return result;
				}
			} catch (err: any) {
				span.recordException(err);
				span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
				span.end();
				throw err;
			}
		});
	}

	async onModuleDestroy() {
		if (this.sdk) {
			await this.sdk.shutdown();
		}
	}
}
