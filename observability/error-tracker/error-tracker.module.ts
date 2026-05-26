import { Global, Module, Provider } from "@nestjs/common";
import { SentryErrorTrackingAdapter } from "./adapters/sentry-error-tracker.adapter";
import { ErrorTrackingService } from "./error-tracking.service";
import { ERROR_TRACKING_PORT } from "./error-tracker.contract";

const ErrorTrackingPortProvider: Provider = {
	provide: ERROR_TRACKING_PORT,
	useClass: SentryErrorTrackingAdapter,
};

@Global()
@Module({
	providers: [ErrorTrackingPortProvider, ErrorTrackingService],
	exports: [ErrorTrackingService],
})
export class ErrorTrackingModule {}
