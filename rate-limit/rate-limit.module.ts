import { Module, DynamicModule, Provider } from "@nestjs/common";
import {
	RATE_LIMIT_PORT,
	RateLimitContract,
} from "./rate-limit.contract";
import {
	InMemoryRateLimitAdapter,
	InMemoryRateLimitConfig,
} from "./in-memory-rate-limit.adapter";

export interface RateLimitModuleOptions {
	adapter?: RateLimitContract;
	inMemory?: InMemoryRateLimitConfig;
}

@Module({})
export class RateLimitModule {
	static forRoot(options: RateLimitModuleOptions = {}): DynamicModule {
		const portProvider: Provider = {
			provide: RATE_LIMIT_PORT,
			useValue:
				options.adapter ??
				new InMemoryRateLimitAdapter(
					options.inMemory ?? { max: 60, windowMs: 60_000 },
				),
		};
		return {
			module: RateLimitModule,
			providers: [portProvider],
			exports: [RATE_LIMIT_PORT],
		};
	}
}
