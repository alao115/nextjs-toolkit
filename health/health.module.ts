import { Module, DynamicModule, Provider } from "@nestjs/common";
import { DbHealthIndicator } from "./db-health.indicator.js";
import { HealthHttpController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { HealthIndicator } from "./health-indicator.interface.js";
import {
	ORM_HEALTH_CLIENT,
	ORM_KIND,
	HEALTH_INDICATORS,
} from "./health.constants.js";
import {
	OrmType,
	PersistenceHealthService,
	PrismaHealthService,
	PrismaService,
} from "../persistence/index.js";
import {
	NotificationHealthIndicator,
	NotificationModule,
} from "../messaging/notification/index.js";

export interface HealthModuleOptions {
	enableDb?: boolean;
	enableNotifications?: boolean;
	orm?: OrmType;
}

@Module({})
export class HealthModule {
	static forRoot(options: HealthModuleOptions = {}): DynamicModule {
		const ownIndicators: Provider[] = [];
		const indicatorTokens: any[] = [];
		if (options.enableDb !== false) {
			ownIndicators.push(DbHealthIndicator);
			indicatorTokens.push(DbHealthIndicator);
		}
		// NotificationHealthIndicator is provided + exported by NotificationModule.
		// We must NOT re-provide it here, or Nest will try to resolve its deps
		// (NOTIFICATION_PROVIDERS, LoggerService) inside the HealthModule injector.
		if (options.enableNotifications !== false) {
			indicatorTokens.push(NotificationHealthIndicator);
		}

		const ormHealthProvider: Provider =
			options.orm === "prisma"
				? {
						provide: ORM_HEALTH_CLIENT,
						inject: [PrismaService],
						useFactory: (
							prismaService: PrismaService,
						): PersistenceHealthService =>
							new PrismaHealthService(prismaService),
					}
				: {
						provide: ORM_HEALTH_CLIENT,
						useValue: {
							ping: async () => true,
						} satisfies PersistenceHealthService,
					};

		return {
			module: HealthModule,
			imports:
				options.enableNotifications !== false ? [NotificationModule] : [],
			controllers: [HealthHttpController],
			providers: [
				HealthService,
				ormHealthProvider,
				{
					provide: ORM_KIND,
					useValue: options.orm,
				},
				...ownIndicators,
				{
					provide: HEALTH_INDICATORS,
					useFactory: (...instances: HealthIndicator[]) => instances,
					inject: indicatorTokens,
				},
			],
			exports: [HealthService],
		};
	}
}
