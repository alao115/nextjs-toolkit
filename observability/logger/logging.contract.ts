export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Free-form context bag passed alongside log messages. Use {@link LogEvent}
 * when you want a canonical, schema-checked shape across adapters.
 */
export interface LogContext {
	[key: string]: any;
}

/**
 * Canonical structured-log shape. Aligns with common log shippers
 * (ELK ECS-like, Datadog, GCP). Adapters should map these fields into
 * their backend's own conventions.
 *
 * All fields except `severity` and `message` are optional so callers can
 * fill what they have without ceremony.
 */
export interface LogEvent {
	severity: LogLevel;
	message: string;
	timestamp?: string;

	// Request / trace correlation
	requestId?: string;
	correlationId?: string;
	traceId?: string;
	spanId?: string;

	// Identity
	userId?: string;
	tenantId?: string;

	// Service identity
	serviceName?: string;
	serviceVersion?: string;
	environment?: string;

	// HTTP context (optional)
	http?: {
		method?: string;
		route?: string;
		status?: number;
		latencyMs?: number;
		userAgent?: string;
		ip?: string;
	};

	// Error context (optional)
	error?: {
		name: string;
		message: string;
		stack?: string;
		code?: string | number;
	};

	// Arbitrary structured attributes
	attributes?: Record<string, unknown>;
}

export interface LoggingContract {
	log(level: LogLevel, message: string, meta?: LogContext): void;
}
