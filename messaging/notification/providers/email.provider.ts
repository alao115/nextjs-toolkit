import { LoggerService } from "../../../observability/logger/logger.service";
import { Inject, Injectable } from "@nestjs/common";
import {
	NotificationProvider,
	NotificationMessage,
	NotificationResult,
	NotificationChannel,
} from "../notification.types";

export interface EmailTransport {
	sendMail(opts: {
		from: string;
		to: string | string[];
		subject: string;
		html: string;
	}): Promise<{ messageId: string }>;

	checkHealth(): Promise<boolean>;
}

@Injectable()
export class EmailProvider implements NotificationProvider {
	readonly name = "email.default";

	@Inject(LoggerService)
	private readonly logger: LoggerService;

	constructor(
		private readonly transport: EmailTransport,
		private readonly fromAddress: string,
	) {}

	supports(channel: NotificationChannel): boolean {
		return channel === "email";
	}

	async send(
		message: NotificationMessage,
		rendered: { subject?: string; body: string },
	): Promise<NotificationResult> {
		try {
			const res = await this.transport.sendMail({
				from: this.fromAddress,
				to: message.to,
				subject: rendered.subject ?? "(no subject)",
				html: rendered.body,
			});

			return {
				success: true,
				provider: this.name,
				messageId: res.messageId,
			};
		} catch (err: any) {
			this.logger.error("Email send failed", {
				to: message.to,
				templateKey: message.templateKey,
				error: err?.message,
			});

			return {
				success: false,
				provider: this.name,
				errorCode: "EMAIL_SEND_FAILED",
				errorMessage: err?.message ?? "Unknown error",
			};
		}
	}

	async checkHealth(): Promise<boolean> {
		// Optional: implement a lightweight ping or a test send to a sink
		return this.transport.checkHealth();
	}
}
