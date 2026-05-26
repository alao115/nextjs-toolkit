import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TracingService } from "./tracing.service";
import { TRACING_PORT, TracingContract } from "./tracing.contract";
import { ShutdownManager } from "../../shutdown/shutdown.manager";

const tracingPortProvider: Provider = {
	provide: TRACING_PORT,
	inject: [ConfigService, ShutdownManager],
	useFactory: (
		configService: ConfigService,
		shutdownManager: ShutdownManager,
	): TracingContract => {
		const provider = configService.get<string>("observability.tracingProvider");

		if (provider === "otel") {
			const {
				OtelTracingAdapter,
			} = require("./adapters/otel-tracing.adapter");
			return new OtelTracingAdapter(configService, shutdownManager);
		}

		const {
			DefaultNoopTracingAdapter,
		} = require("./adapters/default-tracing.adapter");
		return new DefaultNoopTracingAdapter();
	},
};

@Global()
@Module({
	providers: [tracingPortProvider, TracingService],
	exports: [TracingService],
})
export class TracingModule {}
