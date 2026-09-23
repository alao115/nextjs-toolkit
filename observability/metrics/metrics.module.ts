import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MetricsService } from "./metrics.service.js";
import { METRICS_PORT, MetricsContract } from "./metrics.contract.js";
import { MetricsController } from "./metrics.controller.js";
import { ContextModule } from "../../context/context.module.js";

const metricsPortProvider: Provider = {
	provide: METRICS_PORT,
	inject: [ConfigService],
	useFactory: (configService: ConfigService): MetricsContract => {
		const provider = configService.get<string>("observability.metricsProvider");

		if (provider === "prometheus") {
			const {
				PrometheusMetricsAdapter,
			} = require("./adapters/prometheurs-metrics.adapter.js");
			return new PrometheusMetricsAdapter();
		}

		const {
			DefaultNoopMetricsAdapter,
		} = require("./adapters/default-metrics.adapter.js");
		return new DefaultNoopMetricsAdapter();
	},
};

@Global()
@Module({
	imports: [ContextModule],
	providers: [metricsPortProvider, MetricsService],
	controllers: [MetricsController],
	exports: [MetricsService],
})
export class MetricsModule {}
