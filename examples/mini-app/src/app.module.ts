import { Module } from "@nestjs/common";
import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";
import { ObservabilityModule } from "@alaska115/nextjs-toolkit/observability";
import { TenantModule } from "@alaska115/nextjs-toolkit/multi-tenancy";
import { FeatureFlagsModule } from "@alaska115/nextjs-toolkit/feature-flags";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";

import { WidgetController } from "./widget.controller";

@Module({
	imports: [
		ConfigurationModule,
		ShutdownModule,
		// ObservabilityModule.forRoot() wires LoggerModule + TracingModule +
		// MetricsModule + ErrorTrackingModule together AND registers the
		// global request-context + response-wrapping + exception filter.
		// Don't import LoggerModule directly — LoggerService depends on
		// ErrorTrackingService which LoggerModule doesn't provide on its own.
		// metrics: false — the metrics module defaults to "prometheus" provider,
		// which lazy-requires prom-client + has a broken default-import in the
		// published adapter (tracked for 0.4.2). The mini-app doesn't ship
		// prom-client either way, so we disable the pillar here.
		ObservabilityModule.forRoot({
			logging: true,
			tracing: true,
			metrics: false,
			errorTracker: true,
		}),
		TenantModule,
		FeatureFlagsModule.forRoot({
			staticConfig: {
				flags: {
					"new-checkout": true,
					"experimental-search": false,
				},
				variants: {
					"checkout-copy": "v2",
				},
			},
		}),
		HealthModule.forRoot({
			enableDb: true,
			enableNotifications: false,
			orm: "inmemory",
		}),
	],
	controllers: [WidgetController],
})
export class AppModule {}
