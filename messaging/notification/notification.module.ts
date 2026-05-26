import { Module } from "@nestjs/common";
import { NotificationService, IdempotencyStore } from "./notification.service";
import { DefaultNotificationTemplateEngine } from "./template-engines/default-notification-template.engine";
import { EmailProvider, EmailTransport } from "./providers/email.provider";
import { SmsProvider, SmsClient } from "./providers/sms.provider";
import {
	WhatsAppProvider,
	WhatsAppClient,
} from "./providers/whatsapp.provider";
import {
	MAIL_PROVIDER,
	NOTIFICATION_IDEMPOTENCY_STORE,
	NOTIFICATION_PROVIDERS,
	NotificationResult,
	TEMPLATE_ENGINE,
} from "./notification.types";
import { NodemailerEmailAdapter } from "./adapters/nodemailer-notification.adapter";
import { NotificationHealthIndicator } from "./notification.health";
import { LoggerService } from "../../observability/logger/logger.service";
import { ConfigService } from "@nestjs/config";
import { BombooMailNotificationAdapter } from "./adapters/bomboo-mail-notification.adapter";
import { TwigNotificationTemplateEngine } from "./template-engines/twig-notification-template.engine";

const dummySmsClient: SmsClient = {
	async sendSms(to, body) {
		// eslint-disable-next-line no-console
		console.log("[DUMMY SMS] Sending SMS", { to, body });
		return { id: "dummy-sms-id" };
	},

	async checkHealth(): Promise<boolean> {
		return true;
	},
};

const dummyWhatsAppClient: WhatsAppClient = {
	async sendWhatsApp(to, body) {
		// eslint-disable-next-line no-console
		console.log("[DUMMY WHATSAPP] Sending WhatsApp", { to, body });
		return { id: "dummy-whatsapp-id" };
	},
};

// Simple in-memory idempotency store (for dev / tests)
class InMemoryIdempotencyStore implements IdempotencyStore {
	private store = new Map<string, NotificationResult>();

	async get(key: string): Promise<NotificationResult | null> {
		return this.store.get(key) ?? null;
	}

	async set(key: string, result: NotificationResult): Promise<void> {
		this.store.set(key, result);
	}
}

@Module({
	providers: [
		{
			provide: TEMPLATE_ENGINE,
			inject: [ConfigService, LoggerService],
			useFactory: (config: ConfigService, loggerService: LoggerService) => {
				const templatesDir = config.get<string>("mail.templatesDir");
				const engine = config.get<string>("mail.templateEngine");
				loggerService.debug(
					`Notification module: using ${engine} template engine`,
				);
				switch (engine) {
					case "twig":
						return new TwigNotificationTemplateEngine({ templatesDir });
					default:
						return new DefaultNotificationTemplateEngine({ templatesDir });
				}
			},
		},
		NodemailerEmailAdapter,
		BombooMailNotificationAdapter,
		{
			provide: MAIL_PROVIDER,
			inject: [
				ConfigService,
				NodemailerEmailAdapter,
				BombooMailNotificationAdapter,
				LoggerService,
			],
			useFactory: (
				configService: ConfigService,
				nodeMailerEmailTransport: NodemailerEmailAdapter,
				bombooMailNotificationAdapter: BombooMailNotificationAdapter,
				loggerService: LoggerService,
			) => {
				const provider = configService.get("mail.provider");
				loggerService.debug(
					`Notification module: using ${provider} mail provider`,
				);
				switch (provider) {
					case "bomboo":
						return bombooMailNotificationAdapter;
					default:
						return nodeMailerEmailTransport;
				}
			},
		},
		{
			provide: NOTIFICATION_PROVIDERS,
			inject: [MAIL_PROVIDER, ConfigService, LoggerService],
			useFactory: (
				mailProvider: EmailTransport,
				configService: ConfigService,
			) => {
				const from =
					configService.get<string>("mail.sender") || "no-reply@example.com";
				const email = new EmailProvider(mailProvider, from);
				const sms = new SmsProvider(dummySmsClient);
				const wa = new WhatsAppProvider(dummyWhatsAppClient);
				return [email, sms, wa];
			},
		},
		{
			provide: NOTIFICATION_IDEMPOTENCY_STORE,
			useClass: InMemoryIdempotencyStore,
		},
		NotificationHealthIndicator,
		NotificationService,
	],
	exports: [
		NotificationService,
		NOTIFICATION_PROVIDERS,
		NotificationHealthIndicator,
	],
})
export class NotificationModule {}
