import { ConfigService } from "@nestjs/config";
import { AppPersistenceConfig, OrmType } from "./persistence.config";

/**
 * Helper that builds an {@link AppPersistenceConfig} from the
 * Nest {@link ConfigService}. Reads from `persistence.*` and `db.*` keys.
 *
 * Consumers can ignore this helper and pass a hand-built
 * {@link AppPersistenceConfig} to `PersistenceModule.register()` directly.
 */
export function buildPersistenceConfig(
	configService: ConfigService,
): AppPersistenceConfig {
	return {
		orm: configService.get<OrmType>("persistence.orm") ?? "prisma",
		url: configService.get<string>("db.url"),
		runMigrations:
			configService.get<boolean>("persistence.runMigrations") ?? false,
		ormOptions: configService.get<Record<string, any>>("persistence.ormOptions"),
	};
}
