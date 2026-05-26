import { Module, DynamicModule, Provider } from "@nestjs/common";
import { DbHealthIndicator } from "./db-health.indicator";
import { HealthHttpController } from "./health.controller";
import { HealthService } from "./health.service";
import { HealthIndicator } from "./health-indicator.interface";
import {
	ORM_HEALTH_CLIENT,
	ORM_KIND,
	HEALTH_INDICATORS,
} from "./health.constants";
import {
	OrmType,
	PersistenceHealthService,
	PrismaHealthService,
	PrismaService,
} from "../persistence";
import { NotificationHealthIndicator } from "../messaging/notification";

export interface HealthModuleOptions {
	enableDb?: boolean;
	enableNotifications?: boolean;
	orm?: OrmType;
}

@Module({})
export class HealthModule {
	static forRoot(options: HealthModuleOptions = {}): DynamicModule {
		const indicators: any[] = [];
		if (options.enableDb !== false) indicators.push(DbHealthIndicator);
		if (options.enableNotifications !== false)
			indicators.push(NotificationHealthIndicator);

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
			controllers: [HealthHttpController],
			providers: [
				HealthService,
				ormHealthProvider,
				{
					provide: ORM_KIND,
					useValue: options.orm,
				},
				...indicators,
				{
					provide: HEALTH_INDICATORS,
					useFactory: (...instances: HealthIndicator[]) => instances,
					inject: indicators,
				},
			],
			exports: [HealthService],
		};
	}
}
