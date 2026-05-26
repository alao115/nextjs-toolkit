import { Injectable, Inject } from "@nestjs/common";
import {
	NotificationProvider,
	NotificationMessage,
	NotificationResult,
	NotificationChannel,
} from "../notification.types";
import { LoggerService } from "../../../observability/logger/logger.service";

export interface SmsClient {
	sendSms(
		to: string | string[],
		body: string,
		from?: string,
	): Promise<{ id: string }>;
	checkHealth(): Promise<boolean>;
}

@Injectable()
export class SmsProvider implements NotificationProvider {
	readonly name = "sms.default";

	@Inject(LoggerService)
	private readonly logger: LoggerService;

	constructor(private readonly client: SmsClient) {}

	supports(channel: NotificationChannel): boolean {
		return channel === "sms";
	}

	async send(
		message: NotificationMessage,
		rendered: { subject?: string; body: string },
	): Promise<NotificationResult> {
		try {
			const res = await this.client.sendSms(message.to, rendered.body);
			return {
				success: true,
				provider: this.name,
				messageId: res.id,
			};
		} catch (err: any) {
			this.logger.error("SMS send failed", {
				to: message.to,
				templateKey: message.templateKey,
				error: err?.message,
			});

			return {
				success: false,
				provider: this.name,
				errorCode: "SMS_SEND_FAILED",
				errorMessage: err?.message ?? "Unknown error",
			};
		}
	}

	async checkHealth(): Promise<boolean> {
		return this.client.checkHealth();
	}
}
