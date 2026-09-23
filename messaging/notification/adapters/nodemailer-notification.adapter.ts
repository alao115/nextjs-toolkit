import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { NotificationPayload } from "../notification.types.js";
import { EmailTransport } from "../providers/email.provider.js";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class NodemailerEmailAdapter implements EmailTransport {
	constructor(private readonly configService: ConfigService) {}

	private transporter = nodemailer.createTransport({
		host: this.configService.get<string>("mail.host"),
		port: this.configService.get<number>("mail.port"),
		auth: {
			user: this.configService.get<string>("mail.user"),
			pass: this.configService.get<string>("mail.password"),
		},
		secure: this.configService.get<boolean>("mail.secure"),
	});

	async sendMail(payload: NotificationPayload) {
		// `html` carries the rendered template body. This used to read
		// `payload.template` — the template *key*, which EmailProvider never
		// sends — so every message went out with `html: undefined` and arrived
		// empty. Rendering belongs to INotificationTemplateEngine, not here.
		const info = await this.transporter.sendMail({
			from: payload.from ?? this.configService.get<string>("mail.sender"),
			to: payload.to as string,
			subject: payload.subject,
			html: payload.html ?? payload.body,
		});
		return { messageId: info.messageId };
	}

	/**
	 * Verifies the configured SMTP transport: connectivity plus auth, no message
	 * sent.
	 *
	 * This previously ran nodemailer's Ethereal sample code — it created a
	 * throwaway test account over the network and sent a hardcoded
	 * "Hello to myself!" message from sender@example.com on every call. Since
	 * NotificationHealthIndicator calls this per health probe, a Kubernetes
	 * readiness probe was sending a dummy email every few seconds while never
	 * touching the real transport, and reporting "up" regardless of whether the
	 * configured SMTP server was reachable.
	 */
	async checkHealth(): Promise<boolean> {
		try {
			await this.transporter.verify();
			return true;
		} catch {
			return false;
		}
	}
}
