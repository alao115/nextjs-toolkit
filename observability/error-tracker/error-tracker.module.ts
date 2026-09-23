import { Global, Module, Provider } from "@nestjs/common";
import { ErrorTrackingService } from "./error-tracking.service.js";
import {
	ERROR_TRACKING_PORT,
	ErrorTrackingContract,
} from "./error-tracker.contract.js";

/**
 * Binds the Sentry adapter only when `SENTRY_DSN` is set *and* `@sentry/node`
 * is actually installed.
 *
 * `@sentry/node` is an **optional** peer dependency, so it must be `require`d
 * lazily. A static `import` of the adapter here is eagerly loaded by
 * `LoggerModule` (which imports this module), so it made every consumer of the
 * logger crash at load time with `MODULE_NOT_FOUND: @sentry/node` unless they
 * happened to have it installed — which pnpm's `autoInstallPeers` hid, and npm
 * did not.
 *
 * With no adapter bound, `ErrorTrackingService.captureError()` is a no-op.
 */
const ErrorTrackingPortProvider: Provider = {
	provide: ERROR_TRACKING_PORT,
	useFactory: (): ErrorTrackingContract | null => {
		if (!process.env.SENTRY_DSN) return null;

		try {
			const {
				SentryErrorTrackingAdapter,
			} = require("./adapters/sentry-error-tracker.adapter.js");
			return new SentryErrorTrackingAdapter();
		} catch {
			// Deliberately console, not LoggerService: LoggerModule imports this
			// module, so injecting the logger here would close a dependency cycle.
			console.warn(
				"[nextjs-toolkit] SENTRY_DSN is set but '@sentry/node' is not " +
					"installed — error tracking is disabled. Run: npm install @sentry/node",
			);
			return null;
		}
	},
};

@Global()
@Module({
	providers: [ErrorTrackingPortProvider, ErrorTrackingService],
	exports: [ErrorTrackingService],
})
export class ErrorTrackingModule {}
