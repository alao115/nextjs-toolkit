import { Module } from "@nestjs/common";
import { NotificationService, IdempotencyStore } from "./notification.service";
import { DefaultNotificationTemplateEngine } from "./template-engines/default-notification-template.engine";
import { EmailProvider, EmailTransport } from "./providers/email.provider";
import {
	MAIL_PROVIDER,
	NOTIFICATION_IDEMPOTENCY_STORE,
	NOTIFICATION_PROVIDERS,
	NotificationProvider,
	NotificationResult,
	TEMPLATE_ENGINE,
} from "./notification.types";
import { NodemailerEmailAdapter } from "./adapters/nodemailer-notification.adapter";
import { NotificationHealthIndicator } from "./notification.health";
import { LoggerService } from "../../observability/logger/logger.service";
import { ConfigService } from "@nestjs/config";
import { BombooMailNotificationAdapter } from "./adapters/bomboo-mail-notification.adapter";
import { TwigNotificationTemplateEngine } from "./template-engines/twig-notification-template.engine";

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
				loggerService: LoggerService,
			): NotificationProvider[] => {
				const from =
					configService.get<string>("mail.sender") || "no-reply@example.com";

				// Only email ships with a real transport. Earlier versions also
				// registered SmsProvider and WhatsAppProvider backed by clients
				// that console.log'd and returned a fake message id — so
				// `send({ channel: "sms" })` resolved with `success: true` and
				// nothing was ever delivered. Registering no provider is the
				// honest state: NotificationService then throws
				// "No notification provider registered for channel: sms",
				// which surfaces the missing wiring instead of hiding it.
				//
				// To enable those channels, override NOTIFICATION_PROVIDERS with
				// your own array — see docs/modules/messaging.md.
				loggerService.debug(
					"Notification module: email channel registered; sms and whatsapp " +
						"have no provider. Override NOTIFICATION_PROVIDERS to enable them.",
				);

				return [new EmailProvider(mailProvider, from)];
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
