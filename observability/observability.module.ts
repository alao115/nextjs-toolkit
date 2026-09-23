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
} from "./metrics/index.js";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HttpExceptionFilter } from "../errors/http-exception.filter.js";
import { TracingService, TracingModule, TracingInterceptor } from "./tracing/index.js";
import { LoggerService, LoggerModule, LoggerInterceptor } from "./logger/index.js";
import { ErrorTrackingService, ErrorTrackingModule } from "./error-tracker/index.js";
import {
	GlobalResponseInterceptor,
	RequestContextService,
	RequestContextInterceptor,
} from "../context/index.js";

/**
 * Each flag defaults to `true`. Options are merged over those defaults, so
 * `forRoot({ metrics: false })` keeps logging, tracing and error tracking on.
 */
export interface ObservabilityOptions {
	/** Structured logging + the request/response log interceptor. */
	logging?: boolean;
	/** Tracing spans + the tracing interceptor. */
	tracing?: boolean;
	/** Metrics, the metrics interceptor, and `GET /metrics`. */
	metrics?: boolean;
	/** Error-tracking port (a no-op unless an adapter is bound). */
	errorTracker?: boolean;
}

const { ConfigurableModuleClass } =
	new ConfigurableModuleBuilder<ObservabilityOptions>().build();

@Global()
@Module({})
export class ObservabilityModule extends ConfigurableModuleClass {
	static forRoot(userOptions: ObservabilityOptions = {}): DynamicModule {
		// Merge over the defaults rather than replacing them: a caller passing
		// `{ metrics: false }` means "everything except metrics", not "metrics
		// off and the other three undefined" (which read as disabled).
		const options: Required<ObservabilityOptions> = {
			logging: true,
			tracing: true,
			metrics: true,
			errorTracker: true,
			...userOptions,
		};

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

		const controllers = options.metrics ? [MetricsController] : [];

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
