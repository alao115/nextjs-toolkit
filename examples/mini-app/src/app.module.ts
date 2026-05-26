import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";
import {
	LoggerModule,
	MetricsModule,
	TracingModule,
} from "@alaska115/nextjs-toolkit/observability";
import {
	GlobalResponseInterceptor,
	RequestContextInterceptor,
} from "@alaska115/nextjs-toolkit/context";
import { HttpExceptionFilter } from "@alaska115/nextjs-toolkit/errors";
import { TenantModule } from "@alaska115/nextjs-toolkit/multi-tenancy";
import { FeatureFlagsModule } from "@alaska115/nextjs-toolkit/feature-flags";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";

import { WidgetController } from "./widget.controller";

@Module({
	imports: [
		ConfigurationModule,
		ShutdownModule,
		// Importing LoggerModule directly (without ObservabilityModule.forRoot)
		// is the canonical test for the 0.4.2 fix: LoggerService no longer
		// requires ErrorTrackingService.
		LoggerModule,
		TracingModule,
		// Importing MetricsModule with OBSERVABILITY_METRICS=prometheus
		// (the package default) exercises the 0.4.2 PrometheusMetricsAdapter
		// fix. Requires `prom-client` in this package's dependencies.
		MetricsModule,
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
	providers: [
		// RequestContextService comes from the global ContextModule that
		// LoggerModule / TracingModule / MetricsModule transitively import.
		// Don't re-provide it here, or you'll create a separate ALS instance
		// and the interceptor's context won't be visible to LoggerService /
		// TenantService etc.
		{ provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },
		{ provide: APP_FILTER, useClass: HttpExceptionFilter },
	],
})
export class AppModule {}
