/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 01 — Minimal NestJS app wiring.
 *
 * Demonstrates how to compose the core modules at app startup. Copy this
 * into your service's `app.module.ts` and trim to what you actually use.
 */

import { Module } from "@nestjs/common";

// Package modules
import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";
import { LoggerModule } from "@alaska115/nextjs-toolkit/observability";
import { TracingModule } from "@alaska115/nextjs-toolkit/observability";
import { MetricsModule } from "@alaska115/nextjs-toolkit/observability";
import { ObservabilityModule } from "@alaska115/nextjs-toolkit/observability";
import { PersistenceModule } from "@alaska115/nextjs-toolkit/persistence";
import { CacheStoreModule } from "@alaska115/nextjs-toolkit/cache";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";
import { ConfigService } from "@nestjs/config";

// ─── Bring your own Prisma client. The package treats it as a peer dep
//     so it doesn't drag Prisma onto consumers who don't use it.
import { PrismaClient } from "@prisma/client"; // your generated client

@Module({
	imports: [
		// 1. Config FIRST — validates env at boot, makes ConfigService global.
		ConfigurationModule,

		// 2. Shutdown manager — single global instance; other modules use it.
		ShutdownModule,

		// 3. Observability ports — order doesn't matter here, they're all
		//    @Global() and lazy-require their heavy adapters.
		LoggerModule,
		TracingModule,
		MetricsModule,

		// 4. Persistence — register the orm + pass in your Prisma client.
		PersistenceModule.register({
			orm: "prisma",
			url: process.env.DATABASE_URL,
			ormClient: PrismaClient,
		}),

		// 5. Cache — async because it reads `redis.url` from config.
		CacheStoreModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				redisUrl: config.get<string>("redis.url")!,
			}),
		}),

		// 6. Health — opt into the indicators you want, declare orm so
		//    DbHealthIndicator can connect.
		HealthModule.forRoot({
			enableDb: true,
			enableNotifications: false,
			orm: "prisma",
		}),

		// 7. Observability orchestrator — registers the global interceptors.
		ObservabilityModule.forRoot({
			logging: true,
			tracing: true,
			metrics: true,
			errorTracker: true,
		}),
	],
})
export class AppModule {}

/**
 * Boot sequence (`main.ts`):
 *
 * ```ts
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   const config = app.get(ConfigService);
 *
 *   corsRegistration(app, config);
 *   helmetRegistration(app);
 *   contentSecurityPolicyRegistration(app);
 *   registerSwagger({
 *     enabled: config.get<boolean>("swagger.enabled") === true,
 *     app,
 *     config,
 *   });
 *
 *   const port = config.get<number>("http.port") ?? 3001;
 *   await app.listen(port);
 * }
 * bootstrap();
 * ```
 */
