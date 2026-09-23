import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TracingService } from "./tracing.service.js";
import { TRACING_PORT, TracingContract } from "./tracing.contract.js";
import { ShutdownManager } from "../../shutdown/shutdown.manager.js";
import { ContextModule } from "../../context/context.module.js";

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
			} = require("./adapters/otel-tracing.adapter.js");
			return new OtelTracingAdapter(configService, shutdownManager);
		}

		const {
			DefaultNoopTracingAdapter,
		} = require("./adapters/default-tracing.adapter.js");
		return new DefaultNoopTracingAdapter();
	},
};

@Global()
@Module({
	imports: [ContextModule],
	providers: [tracingPortProvider, TracingService],
	exports: [TracingService],
})
export class TracingModule {}
