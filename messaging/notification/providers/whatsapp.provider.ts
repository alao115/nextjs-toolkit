import { Inject, Injectable } from "@nestjs/common";
import {
	NotificationProvider,
	NotificationMessage,
	NotificationResult,
	NotificationChannel,
} from "../notification.types";
import { LoggerService } from "../../../observability/logger/logger.service";

export interface WhatsAppClient {
	sendWhatsApp(to: string | string[], body: string): Promise<{ id: string }>;
}

@Injectable()
export class WhatsAppProvider implements NotificationProvider {
	readonly name = "whatsapp.default";

	@Inject(LoggerService)
	private readonly logger: LoggerService;

	constructor(private readonly client: WhatsAppClient) {}

	supports(channel: NotificationChannel): boolean {
		return channel === "whatsapp";
	}

	async send(
		message: NotificationMessage,
		rendered: { subject?: string; body: string },
	): Promise<NotificationResult> {
		try {
			const res = await this.client.sendWhatsApp(message.to, rendered.body);
			return {
				success: true,
				provider: this.name,
				messageId: res.id,
			};
		} catch (err: any) {
			this.logger.error("WhatsApp send failed", {
				to: message.to,
				templateKey: message.templateKey,
				error: err?.message,
			});

			return {
				success: false,
				provider: this.name,
				errorCode: "WHATSAPP_SEND_FAILED",
				errorMessage: err?.message ?? "Unknown error",
			};
		}
	}

	async checkHealth(): Promise<boolean> {
		return true;
	}
}
