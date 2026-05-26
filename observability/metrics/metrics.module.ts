import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MetricsService } from "./metrics.service";
import { METRICS_PORT, MetricsContract } from "./metrics.contract";
import { MetricsController } from "./metrics.controller";

const metricsPortProvider: Provider = {
	provide: METRICS_PORT,
	inject: [ConfigService],
	useFactory: (configService: ConfigService): MetricsContract => {
		const provider = configService.get<string>("observability.metricsProvider");

		if (provider === "prometheus") {
			const {
				PrometheusMetricsAdapter,
			} = require("./adapters/prometheurs-metrics.adapter");
			return new PrometheusMetricsAdapter();
		}

		const {
			DefaultNoopMetricsAdapter,
		} = require("./adapters/default-metrics.adapter");
		return new DefaultNoopMetricsAdapter();
	},
};

@Global()
@Module({
	providers: [metricsPortProvider, MetricsService],
	controllers: [MetricsController],
	exports: [MetricsService],
})
export class MetricsModule {}
