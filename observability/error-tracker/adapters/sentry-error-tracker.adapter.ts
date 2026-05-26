import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { ErrorTrackingContract } from "../error-tracker.contract";

@Injectable()
export class SentryErrorTrackingAdapter implements ErrorTrackingContract {
	constructor() {
		if (process.env.SENTRY_DSN) {
			Sentry.init({
				dsn: process.env.SENTRY_DSN,
				environment: process.env.NODE_ENV,
				release: process.env.RELEASE_VERSION,
				beforeSend(event) {
					if (event.request) {
						delete event.request.cookies;
						if (event.request.headers) {
							delete event.request.headers.authorization;
						}
					}
					return event;
				},
			});
		}
	}

	captureError(error: unknown, context?: Record<string, any>): void {
		if (!process.env.SENTRY_DSN) return;

		Sentry.withScope((scope) => {
			if (context) {
				Object.entries(context).forEach(([key, value]) => {
					scope.setExtra(key, value as any);
				});

				if (context["userId"]) {
					scope.setUser({ id: String(context["userId"]) });
				}
			}

			Sentry.captureException(error);
		});
	}
}
