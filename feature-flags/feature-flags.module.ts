import { Module, DynamicModule, Provider } from "@nestjs/common";
import {
	FEATURE_FLAGS_PORT,
	FeatureFlagContract,
} from "./feature-flags.contract";
import { FeatureFlagsService } from "./feature-flags.service";
import {
	StaticFeatureFlagsAdapter,
	StaticFeatureFlagsConfig,
} from "./static-feature-flags.adapter";

export interface FeatureFlagsModuleOptions {
	/**
	 * Custom adapter instance. Mutually exclusive with `staticConfig`.
	 */
	adapter?: FeatureFlagContract;
	/**
	 * Inline static config — uses {@link StaticFeatureFlagsAdapter}.
	 */
	staticConfig?: StaticFeatureFlagsConfig;
}

@Module({})
export class FeatureFlagsModule {
	static forRoot(options: FeatureFlagsModuleOptions = {}): DynamicModule {
		const portProvider: Provider = {
			provide: FEATURE_FLAGS_PORT,
			useValue:
				options.adapter ??
				new StaticFeatureFlagsAdapter(options.staticConfig ?? {}),
		};

		return {
			module: FeatureFlagsModule,
			providers: [portProvider, FeatureFlagsService],
			exports: [FeatureFlagsService],
		};
	}
}
