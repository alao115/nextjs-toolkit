import * as Joi from "joi";

/**
 * Joi validation schema for environment variables read by {@link configuration}.
 *
 * Philosophy: validate the *shape* (types, enums) of every env var the package
 * knows about, but require very little — most secrets are only needed when a
 * specific feature is used, and consumers running in test/in-memory mode
 * shouldn't have to provide them. Consumers can extend this schema for their
 * own env vars and re-pass it to `ConfigModule.forRoot()`.
 */
export const configValidationSchema = Joi.object({
	NODE_ENV: Joi.string()
		.valid("development", "test", "staging", "production")
		.default("development"),

	APP_NAME: Joi.string().optional(),
	APP_ENV: Joi.string()
		.valid("development", "test", "staging", "production")
		.default("development"),
	APP_MODE: Joi.string()
		.valid("monolith", "microservice", "worker")
		.default("monolith"),
	APP_BASE_URL: Joi.string().uri().optional(),
	FRONTEND_URL: Joi.string().uri().optional(),
	DASHBOARD_URL: Joi.string().uri().optional(),
	BASE_URL: Joi.string().uri().optional(),
	GENERATE_API_DOCS: Joi.boolean().optional(),

	// HTTP
	HTTP_PORT: Joi.number().default(3001),
	HTTP_GLOBAL_PREFIX: Joi.string().default("api"),

	// CORS
	CORS_ENABLED: Joi.boolean().optional(),
	CORS_ORIGINS: Joi.string().optional(),

	// Auth — every secret is optional. If your service relies on JWT, set it;
	// the JWT library will surface a clear error at first use if unset.
	AUTH_MODE: Joi.string().valid("jwt", "cookie").optional(),
	JWT_SECRET: Joi.string().min(16).optional(),
	JWT_REFRESH_SECRET: Joi.string().min(16).optional(),
	JWT_CITIZEN_SECRET: Joi.string().min(16).optional(),
	JWT_CITIZEN_REFRESH_SECRET: Joi.string().min(16).optional(),
	JWT_ACCESS_TTL: Joi.number().optional(),
	JWT_REFRESH_TTL: Joi.number().optional(),
	SESSION_SECRET: Joi.string().min(16).optional(),
	SESSION_COOKIE_NAME: Joi.string().optional(),
	SESSION_COOKIE_DOMAIN: Joi.string().optional(),
	MAX_FAILED_AUTH: Joi.number().optional(),
	LOCKOUT_DURATION: Joi.number().optional(),

	SUPER_ADMIN_EMAIL: Joi.string().email().optional(),
	SUPER_ADMIN_TEMP_PASSWORD: Joi.string().min(8).optional(),

	// Database
	DATABASE_URL: Joi.string().uri({ scheme: [/postgres(ql)?/, "mysql", "sqlite", "file"] }).optional(),
	DB_HOST: Joi.string().optional(),
	DB_PORT: Joi.number().default(5432),
	DB_USER: Joi.string().optional(),
	DB_PASSWORD: Joi.string().optional(),
	DB_NAME: Joi.string().optional(),
	DB_RUN_MIGRATIONS: Joi.boolean().optional(),
	ORM_TYPE: Joi.string().valid("prisma", "inmemory").optional(),

	// Redis
	REDIS_URL: Joi.string().uri({ scheme: ["redis", "rediss"] }).optional(),

	// RMQ / Kafka
	RMQ_URL: Joi.string().optional(),
	RMQ_QUEUE: Joi.string().optional(),
	KAFKA_BROKER: Joi.string().optional(),
	KAFKA_GROUP_ID: Joi.string().optional(),

	// KMS / Secrets manager
	KMS_PROVIDER: Joi.string()
		.valid("local", "aws-kms", "gcp-kms", "vault")
		.default("local"),
	LOCAL_MASTER_KEY: Joi.string().when("KMS_PROVIDER", {
		is: "local",
		then: Joi.optional(),
		otherwise: Joi.optional(),
	}),
	AWS_REGION: Joi.string().optional(),
	AWS_KMS_KEY_ID: Joi.string().optional(),
	VAULT_ADDR: Joi.string().optional(),
	VAULT_TOKEN: Joi.string().optional(),

	// Observability
	OBSERVABILITY_LOGGING: Joi.string().valid("winston", "console").optional(),
	OBSERVABILITY_METRICS: Joi.string().valid("prometheus", "noop").optional(),
	OBSERVABILITY_TRACING: Joi.string().valid("otel", "noop").optional(),
	LOG_LEVEL: Joi.string()
		.valid("debug", "info", "warn", "error")
		.default("info"),
	LOG_DIR: Joi.string().default("logs"),
	LOG_FILE: Joi.string().default("api"),
	LOG_DISPLAY_CONSOLE: Joi.boolean().optional(),

	// File storage
	FILE_STORAGE_ADAPTER: Joi.string().valid("minio", "disk").default("minio"),
	FILE_STORAGE_PATH: Joi.string().default("./uploads"),
	MINIO_URL: Joi.string().optional(),
	MINIO_PORT: Joi.number().optional(),
	MINIO_SECURE: Joi.boolean().optional(),
	MINIO_ACCESS_KEY: Joi.string().optional(),
	MINIO_SECRET_KEY: Joi.string().optional(),
	MINIO_PRIVATE_BUCKET: Joi.string().optional(),
	MINIO_PUBLIC_BUCKET: Joi.string().optional(),
	MINIO_STAGING_BUCKET: Joi.string().optional(),

	// Mail
	MAIL_HOST: Joi.string().optional(),
	MAIL_PORT: Joi.number().optional(),
	MAIL_USER: Joi.string().optional(),
	MAIL_PASSWORD: Joi.string().optional(),
	MAIL_SENDER: Joi.string().email().optional(),
	MAIL_SECURE: Joi.boolean().optional(),
	MAIL_TEMPLATE_ENGINE: Joi.string().valid("twig", "default").optional(),
	MAIL_PROVIDER: Joi.string().optional(),
	NOTIFICATION_TEMPLATES_DIR: Joi.string().optional(),

	// SMS
	SMS_PROVIDER: Joi.string().optional(),

	// OTP
	OTP_TTL_SECONDS: Joi.number().default(600),
	OTP_RESEND_COOLDOWN: Joi.number().default(60),
	OTP_MAX_ATTEMPTS: Joi.number().default(5),
	OTP_MAX_SENDS_PER_HOUR: Joi.number().default(5),
	OTP_HASH_SECRET: Joi.string().min(16).optional(),

	// ngrok (dev only)
	NGROK_ENABLED: Joi.boolean().optional(),
	NGROK_TOKEN: Joi.string().optional(),
	NGROK_DOMAIN: Joi.string().optional(),

});
