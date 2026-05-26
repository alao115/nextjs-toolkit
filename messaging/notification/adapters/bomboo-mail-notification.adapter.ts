import { Injectable } from "@nestjs/common";
import { NotificationPayload } from "../notification.types";
import { EmailTransport } from "../providers/email.provider";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "../../../observability/logger";
import { TracingService } from "../../../observability/tracing";

@Injectable()
export class BombooMailNotificationAdapter implements EmailTransport {
	constructor(
		private readonly configService: ConfigService,
		private readonly loggerService: LoggerService,
		private readonly tracingService: TracingService,
	) {}

	async sendMail(opts: NotificationPayload) {
		return this.tracingService.runInSpan(
			"BombooMailNotificationAdapter.sendMail",
			async () => {
				this.loggerService.info("Sending mail", {
					from: opts.from,
					to: opts.to,
				});
				const payload: any = {
					sender: opts.from,
					object: opts.subject,
					body: opts.html,
					contacts: Array.isArray(opts.to)
						? opts.to.map((to) => ({ email: to }))
						: [{ email: opts.to }],
				};

				const bombooConfig = this.configService.get<{
					email_url: string;
					api_key: string;
				}>("mail.bomboo");

				if (!bombooConfig?.email_url || !bombooConfig?.api_key) {
					throw new Error(
						"BombooMailNotificationAdapter: mail.bomboo.{email_url,api_key} are not configured",
					);
				}

				const response = await fetch(bombooConfig.email_url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						api_key: bombooConfig.api_key,
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const error = await response.clone().json();
					this.loggerService.error("Bomboo mail notification failed", {
						error,
						payload,
					});
				}

				const responseData = await response.json();
				this.loggerService.info("Bomboo mail notification sent", {
					messageId: responseData.sid,
				});

				return { messageId: responseData.sid };
			},
		);
	}

	async checkHealth(): Promise<boolean> {
		return true;
	}
}
