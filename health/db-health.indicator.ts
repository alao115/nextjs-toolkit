import { Injectable, Inject } from "@nestjs/common";
import {
	HealthIndicator,
	HealthIndicatorResult,
} from "./health-indicator.interface";
import { OrmType, PersistenceHealthService } from "../persistence";
import { ORM_HEALTH_CLIENT, ORM_KIND } from "./health.constants";

@Injectable()
export class DbHealthIndicator implements HealthIndicator {
	name = "db" as const;

	constructor(
		@Inject(ORM_KIND) private readonly ormKind: OrmType,
		@Inject(ORM_HEALTH_CLIENT)
		private readonly ormHealthClient: PersistenceHealthService,
	) {}

	async check(): Promise<HealthIndicatorResult> {
		const started = Date.now();

		try {
			// ormHealthClient must expose some orm-agnostic ping() in your OrmModule:
			// For Prisma: await prisma.$queryRaw`SELECT 1`;
			// For TypeORM: await dataSource.query('SELECT 1');
			// etc.
			await this.ormHealthClient.ping();

			return {
				name: this.name,
				status: "up",
				info: {
					orm: this.ormKind,
					latencyMs: Date.now() - started,
				},
			};
		} catch (e) {
			return {
				name: this.name,
				status: "down",
				info: {
					orm: this.ormKind,
					error: (e as Error).message,
				},
			};
		}
	}
}
