export type OrmType = "prisma" | "inmemory";

export const PRISMA_OPTIONS = Symbol("PRISMA_OPTIONS");
export const PRISMA_CLIENT = Symbol("PRISMA_CLIENT");

export interface PrismaModuleOptions {
	connectionString: string;
}

export interface AppPersistenceConfig {
	orm: OrmType;

	/**
	 * Database URL, when relevant (e.g. Postgres).
	 * For in-memory mode, this can be ignored.
	 */
	url?: string;

	/**
	 * Whether to run migrations automatically at startup (if supported).
	 */
	runMigrations?: boolean;

	/**
	 * Any ORM-specific options, left open.
	 */
	ormOptions?: Record<string, any>;

	/**
	 * Whether to enable the health check.
	 */
	enableHealthCheck?: boolean;

	/** The ORM client to use, if any */
	ormClient?: any;

	/**
	 * Factory that produces a driver adapter instance for the Prisma client
	 * (e.g. PrismaPg, PrismaMysql, PrismaSqlite). Receives the configured `url`.
	 * If omitted, defaults to `@prisma/adapter-pg`.
	 */
	driverFactory?: (url?: string) => any;
}
