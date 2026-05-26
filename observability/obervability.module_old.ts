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

const {
	ConfigurableModuleClass,
	MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<ObservabilityOptions>()
	.setClassMethodName("forRoot")
	.build();

// @Global()
// @Module({})
// export class ObservabilityModule extends ConfigurableModuleClass {
// 	static override forRootAsync(
// 		options: Parameters<typeof ConfigurableModuleClass.forRootAsync>[0],
// 	): DynamicModule {
// 		const baseModule = super.forRootAsync(options);

// 		const providers: Provider[] = [
// 			...(baseModule.providers ?? []),
// 			RequestContextService,
// 			LoggerService,
// 			TracingService,
// 			ErrorTrackingService,
// 			{
// 				provide: APP_INTERCEPTOR,
// 				useClass: RequestContextInterceptor,
// 			},
// 			{
// 				provide: APP_INTERCEPTOR,
// 				useClass: GlobalResponseInterceptor,
// 			},
// 			{
// 				provide: APP_FILTER,
// 				useClass: HttpExceptionFilter,
// 			},

// 			createConditionalInterceptorProvider(
// 				LoggerInterceptor,
// 				'logging',
// 			),
// 			createConditionalInterceptorProvider(
// 				TracingInterceptor,
// 				'tracing',
// 			),
// 			createConditionalInterceptorProvider(
// 				MetricsInterceptor,
// 				'metrics',
// 			),
// 		];

// 		const imports = [
// 			...(baseModule.imports ?? []),
// 			LoggerModule,
// 			TracingModule,
// 			MetricsModule,
// 			ErrorTrackingModule,
// 		];

// 		return {
// 			...baseModule,
// 			imports,
// 			providers,
// 			exports: [
// 				RequestContextService,
// 				LoggerService,
// 				TracingService,
// 				ErrorTrackingService,
// 			],
// 			controllers: [MetricsController],
// 		};
// 	}
// }

// function createConditionalInterceptorProvider(
// 	InterceptorClass: any,
// 	flag: keyof ObservabilityOptions,
// ): Provider {
// 	return {
// 		provide: APP_INTERCEPTOR,
// 		inject: [MODULE_OPTIONS_TOKEN, InterceptorClass],
// 		useFactory: (
// 			options: ObservabilityOptions,
// 			interceptor: any,
// 		) => {
// 			if (options?.[flag] === false) {
// 				return undefined;
// 			}
// 			return interceptor;
// 		},
// 	};
// }

@Global()
@Module({})
export class ObservabilityModule {
	static forRootAsync(options: ObservabilityOptions): DynamicModule {
		// const observabilities: ObservabilityOptions = options.useFactory();

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

		const imports = [];
		if (options.logging !== false) {
			imports.push(LoggerModule);
			interceptors.push({
				provide: "APP_INTERCEPTOR",
				useClass: LoggerInterceptor,
			});
		}

		if (options.tracing !== false) {
			imports.push(TracingModule);
			interceptors.push({
				provide: "APP_INTERCEPTOR",
				useClass: TracingInterceptor,
			});
		}

		if (options.metrics !== false) {
			imports.push(MetricsModule);
			interceptors.push({
				provide: "APP_INTERCEPTOR",
				useClass: MetricsInterceptor,
			});
		}

		if (options.errorTracker !== false) {
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
