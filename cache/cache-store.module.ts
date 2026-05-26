import { DynamicModule, Global, Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import KeyvRedis from "@keyv/redis";
import Redis from "ioredis";
import { CacheStoreService } from "./cache-store.service";
import { CACHE_STORE_OPTIONS, CUSTOM_REDIS_CLIENT } from "./cache.utils";

export interface CacheStoreOptions {
  redisUrl: string;
}

@Global()
@Module({})
export class CacheStoreModule {
  static forRootAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => Promise<CacheStoreOptions> | CacheStoreOptions;
  }): DynamicModule {

		const asyncOptionsProvider = {
			provide: CACHE_STORE_OPTIONS,
			useFactory: options.useFactory,
			inject: options.inject,
		};

    return {
      module: CacheStoreModule,
      imports: [
        ...(options.imports ?? []),
        CacheModule.registerAsync({
          inject: [CACHE_STORE_OPTIONS],
          useFactory: async (options: CacheStoreOptions) => {
            return {
              stores: [new KeyvRedis(options.redisUrl)],
            };
          },
        }),
      ],
      providers: [
				asyncOptionsProvider,
        CacheStoreService,
        {
          provide: CUSTOM_REDIS_CLIENT,
          inject: [CACHE_STORE_OPTIONS],
          useFactory: async (options: CacheStoreOptions) => {
            return new Redis(options.redisUrl);
          },
        },
      ],
      exports: [CacheStoreService, CUSTOM_REDIS_CLIENT, CACHE_STORE_OPTIONS],
    };
  }
}
