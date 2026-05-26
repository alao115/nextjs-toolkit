import {
	ConfigurableModuleBuilder,
	DynamicModule,
	Global,
	Module,
	Provider,
} from "@nestjs/common";

import {
	MetricsController,
	MetricsModule,
	MetricsInterceptor,
} from "./metrics";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HttpExceptionFilter } from "../errors/http-exception.filter";
import { TracingService, TracingModule, TracingInterceptor } from "./tracing";
import { LoggerService, LoggerModule, LoggerInterceptor } from "./logger";
import { ErrorTrackingService, ErrorTrackingModule } from "./error-tracker";
import {
	GlobalResponseInterceptor,
	RequestContextService,
	RequestContextInterceptor,
} from "../context";

export interface ObservabilityOptions {
	logging?: boolean;
	tracing?: boolean;
	metrics?: boolean;
	errorTracker?: boolean;
}

const { ConfigurableModuleClass } =
	new ConfigurableModuleBuilder<ObservabilityOptions>().build();

@Global()
@Module({})
export class ObservabilityModule extends ConfigurableModuleClass {
	static forRoot(
		options: ObservabilityOptions = {
			logging: true,
			tracing: true,
			metrics: true,
			errorTracker: true,
		},
	): DynamicModule {
		const providers: Provider[] = [RequestContextService];

		const interceptors: Provider[] = [
			{
				provide: APP_INTERCEPTOR,
				useClass: RequestContextInterceptor,
			},
			{
				provide: APP_INTERCEPTOR,
				useClass: GlobalResponseInterceptor,
			},
			{
				provide: APP_FILTER,
				useClass: HttpExceptionFilter,
			},
		];

		const imports: any[] = [];
		if (options.logging) {
			imports.push(LoggerModule);
			interceptors.push({
				provide: APP_INTERCEPTOR,
				useClass: LoggerInterceptor,
			});
		}

		if (options.tracing) {
			imports.push(TracingModule);
			interceptors.push({
				provide: APP_INTERCEPTOR,
				useClass: TracingInterceptor,
			});
		}

		if (options.metrics) {
			imports.push(MetricsModule);
			interceptors.push({
				provide: APP_INTERCEPTOR,
				useClass: MetricsInterceptor,
			});
		}

		if (options.errorTracker) {
			imports.push(ErrorTrackingModule);
		}

		const controllers = options.metrics !== false ? [MetricsController] : [];

		return {
			module: ObservabilityModule,
			imports,
			providers: [
				...providers,
				...interceptors,
				TracingService,
				LoggerService,
				ErrorTrackingService,
			],
			controllers,
			exports: [
				RequestContextService,
				TracingService,
				LoggerService,
				ErrorTrackingService,
			],
		};
	}
}
