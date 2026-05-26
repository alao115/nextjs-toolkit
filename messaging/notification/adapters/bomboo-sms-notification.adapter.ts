import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "../../../observability/logger";
import { SmsClient } from "../providers/sms.provider";
import { TracingService } from "../../../observability/tracing";

@Injectable()
export class BombooSmsNotificationAdapter implements SmsClient {
	constructor(
		private readonly configService: ConfigService,
		private readonly loggerService: LoggerService,
		private readonly tracingService: TracingService,
	) {}

	async sendSms(to: string | string[], body: string, from: string) {
		return this.tracingService.runInSpan(
			"BombooSmsNotificationAdapter.sendSms",
			async () => {
				this.loggerService.info("Sending sms", { to, body, from });
				const payload: any = {
					sender: from,
					body: body,
					contacts: Array.isArray(to)
						? to.map((to) => ({ msisdn: to, country_code: "+229" }))
						: [{ msisdn: to, country_code: "+229" }],
				};

				const bombooConfig = this.configService.get<{
					sms_url: string;
					api_key: string;
				}>("sms.bomboo");

				if (!bombooConfig?.sms_url || !bombooConfig?.api_key) {
					throw new Error(
						"BombooSmsNotificationAdapter: sms.bomboo.{sms_url,api_key} are not configured",
					);
				}

				const response = await fetch(bombooConfig.sms_url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						api_key: bombooConfig.api_key,
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const error = await response.clone().json();
					this.loggerService.error("Bomboo sms notification failed", {
						error,
						payload,
					});
				}

				const responseData = await response.json();

				this.loggerService.info("Bomboo sms notification sent", {
					messageId: responseData,
				});

				return { id: responseData.sid };
			},
		);
	}

	async checkHealth(): Promise<boolean> {
		return true;
	}
}
