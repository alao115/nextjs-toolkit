export interface ErrorTrackingContract {
	captureError(
		error: unknown,
		context?: Record<string, any>,
	): void | Promise<void>;
}

export const ERROR_TRACKING_PORT = Symbol.for("@alaska115/nextjs-toolkit:ERROR_TRACKING_PORT");
