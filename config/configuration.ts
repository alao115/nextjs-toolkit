export default () => ({
	nodeEnv: process.env.NODE_ENV,

	app: {
		name: process.env.APP_NAME ?? "app",
		mode: process.env.APP_MODE ?? "monolith",
		env: process.env.APP_ENV ?? "development",
		generateAPIDocs: process.env.GENERATE_API_DOCS === "true",
		includeFileTransport: false,
		frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
		dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:3000",
		baseUrl: process.env.BASE_URL || "http://localhost:3001",
	},

	cors: {
		enabled: process.env.CORS_ENABLED === "true" || true,
		origin: process.env.CORS_ORIGINS || "*",
	},

	auth: {
		superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
		superAdminTempPassword: process.env.SUPER_ADMIN_TEMP_PASSWORD,
		mode: process.env.AUTH_MODE || "jwt", // or 'cookie'
		jwt: {
			accessTokenTtlSec: parseInt(process.env.JWT_ACCESS_TTL || "300", 10), // 5m
			refreshTokenTtlSec: parseInt(
				process.env.JWT_REFRESH_TTL || (60 * 60 * 24 * 30).toString(),
				10,
			), // 30d
			secret: process.env.JWT_SECRET,
			refreshSecret: process.env.JWT_REFRESH_SECRET,
			citizenSecret: process.env.JWT_CITIZEN_SECRET,
			citizenRefreshSecret: process.env.JWT_CITIZEN_REFRESH_SECRET,
		},
		cookie: {
			name: process.env.SESSION_COOKIE_NAME || "sid",
			domain: process.env.SESSION_COOKIE_DOMAIN,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			httpOnly: true,
			secret: process.env.SESSION_SECRET,
		},
		maxFailedAuthBeforeLock: parseInt(process.env.MAX_FAILED_AUTH || "10", 10),
		lockoutDurationSec: parseInt(
			process.env.LOCKOUT_DURATION || String(60 * 15),
			10,
		), // 15 min
		keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL,
		keycloakIssuer: process.env.KEYCLOAK_ISSUER,
		keycloakAdminUrl: process.env.KEYCLOAK_ADMIN_URL,
		citizenPortalRedirectUri: process.env.CITIZEN_PORTAL_REDIRECT_URI,
		citizenPortalClientId: process.env.CITIZEN_PORTAL_CLIENT_ID,
		adminPortalRedirectUri: process.env.ADMIN_PORTAL_REDIRECT_URI,
		adminPortalClientId: process.env.ADMIN_PORTAL_CLIENT_ID,
		iosServiceSecret: process.env.IOS_SERVICE_SECRET,
		iosServiceClientId: process.env.IOS_SERVICE_CLIENT_ID,
	},

	observability: {
		enabledLog: true,
		enabledTracing: true,
		enabledMetrics: true,
		metricsProvider: process.env.OBSERVABILITY_METRICS ?? "prometheus",
		tracingProvider: process.env.OBSERVABILITY_TRACING ?? "otel",
		loggingProvider: process.env.OBSERVABILITY_LOGGING ?? "winston",
	},

	http: {
		port: parseInt(process.env.HTTP_PORT ?? "3001", 10),
		globalPrefix: process.env.HTTP_GLOBAL_PREFIX ?? "api",
		apiVersion: "1",
	},

	ngrok: {
		enabled: process.env.NGROK_ENABLED === "true" || false,
		token: process.env.NGROK_TOKEN,
		domain: process.env.NGROK_DOMAIN,
	},

	db: {
		url: process.env.DATABASE_URL,
		host: process.env.DB_HOST,
		port: parseInt(process.env.DB_PORT ?? "5432", 10),
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		name: process.env.DB_NAME,
	},

	redis: {
		url: process.env.REDIS_URL,
	},

	rmq: {
		url: process.env.RMQ_URL,
		queue: process.env.RMQ_QUEUE ?? "default_queue",
	},

	kafka: {
		broker: process.env.KAFKA_BROKER,
		groupId: process.env.KAFKA_GROUP_ID,
	},

	kms: {
		provider: process.env.KMS_PROVIDER ?? "local",
		localMasterKey: process.env.LOCAL_MASTER_KEY,
		awsRegion: process.env.AWS_REGION,
		awsKmsKeyId: process.env.AWS_KMS_KEY_ID,
		vaultAddr: process.env.VAULT_ADDR,
		vaultToken: process.env.VAULT_TOKEN,
	},

	logging: {
		displayConsole: process.env.LOG_DISPLAY_CONSOLE === "true",
		level: process.env.LOG_LEVEL ?? "info",
		dir: process.env.LOG_DIR ?? "logs",
		file: process.env.LOG_FILE ?? "api",
	},

	mail: {
		host: process.env.MAIL_HOST,
		port: parseInt(process.env.MAIL_PORT || "25", 10),
		user: process.env.MAIL_USER,
		password: process.env.MAIL_PASSWORD,
		sender: process.env.MAIL_SENDER,
		secure: process.env.MAIL_SECURE === "true",
		templateEngine: process.env.MAIL_TEMPLATE_ENGINE || "twig",
		templatesDir: process.env.NOTIFICATION_TEMPLATES_DIR,

		provider: process.env.MAIL_PROVIDER,

		bomboo: {
			api_key: process.env.BOMBOO_API_KEY,
			email_url: process.env.BOMBOO_EMAIL_URL,
		},
	},

	sms: {
		provider: process.env.SMS_PROVIDER,
		bomboo: {
			api_key: process.env.BOMBOO_API_KEY,
			sms_url: process.env.BOMBOO_SMS_URL,
		},
	},

	otp: {
		codeLength: 6,
		ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 600), // 10 min
		resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN ?? 60),
		maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
		maxSendsPerHour: Number(process.env.OTP_MAX_SENDS_PER_HOUR ?? 5),
		codeAlphabet: "0123456789",
		redisPrefix: "otp",
		hashSecret: process.env.OTP_HASH_SECRET,
	},

	files: {
		storage: {
			adapter: process.env.FILE_STORAGE_ADAPTER || "minio",
			path: process.env.FILE_STORAGE_PATH || "./uploads",
		},
	},

	minio: {
		url: process.env.MINIO_URL,
		port: parseInt(process.env.MINIO_PORT ?? "9000", 10),
		secure: process.env.MINIO_SECURE === "true",
		accessKey: process.env.MINIO_ACCESS_KEY,
		secretKey: process.env.MINIO_SECRET_KEY,
		buckets: {
			private: process.env.MINIO_PRIVATE_BUCKET,
			public: process.env.MINIO_PUBLIC_BUCKET,
			staging: process.env.MINIO_STAGING_BUCKET,
		},
	},
});
