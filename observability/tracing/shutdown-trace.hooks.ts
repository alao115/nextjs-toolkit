import { Injectable } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { ShutdownManager } from "../../shutdown/shutdown.manager";

@Injectable()
export class TracingShutdownHook {
	constructor(private readonly shutdownManager: ShutdownManager) {
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
}
