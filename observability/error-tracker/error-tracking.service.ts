import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	ERROR_TRACKING_PORT,
	ErrorTrackingContract,
} from "./error-tracker.contract";

@Injectable()
export class ErrorTrackingService {
	constructor(
		@Optional()
		@Inject(ERROR_TRACKING_PORT)
		private readonly impl?: ErrorTrackingContract,
	) {}

	captureError(error: unknown, context?: Record<string, any>) {
		if (!this.impl) return;
		return this.impl.captureError(error, context);
	}
}
