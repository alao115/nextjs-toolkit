import { Module } from "@nestjs/common";
import { NotificationService, IdempotencyStore } from "./notification.service.js";
import { EmailProvider, EmailTransport } from "./providers/email.provider.js";
import {
	MAIL_PROVIDER,
	NOTIFICATION_IDEMPOTENCY_STORE,
	NOTIFICATION_PROVIDERS,
	NotificationProvider,
	NotificationResult,
	TEMPLATE_ENGINE,
} from "./notification.types.js";
import { NotificationHealthIndicator } from "./notification.health.js";
import { LoggerService } from "../../observability/logger/logger.service.js";
import { ConfigService } from "@nestjs/config";
import { TracingService } from "../../observability/tracing/tracing.service.js";

/**
 * Template engines and mail adapters are `require`d on demand instead of
 * imported at the top of this file.
 *
 * `nodemailer` and `twig` are optional peer dependencies, and a static import
 * loads them the moment this module is loaded — which `HealthModule` does
 * unconditionally, even with `enableNotifications: false`, because the import
 * happens before any option is read. That made `@alaska115/nextjs-toolkit/health`
 * and `/messaging` fail with `MODULE_NOT_FOUND: nodemailer` for consumers who
 * never send mail. pnpm's `autoInstallPeers` masked it; npm did not.
 */
function requireOptional<T>(
	load: () => T,
	pkg: string,
	feature: string,
): T {
	try {
		return load();
	} catch {
		throw new Error(
			`${feature} requires the optional peer dependency '${pkg}'. ` +
				`Install it with: npm install ${pkg}`,
		);
	}
}

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
				if (engine === "twig") {
					const { TwigNotificationTemplateEngine } = requireOptional(
						() => require("./template-engines/twig-notification-template.engine.js"),
						"twig",
						"mail.templateEngine='twig'",
					);
					return new TwigNotificationTemplateEngine({ templatesDir });
				}

				const {
					DefaultNotificationTemplateEngine,
				} = require("./template-engines/default-notification-template.engine.js");
				return new DefaultNotificationTemplateEngine({ templatesDir });
			},
		},
		{
			provide: MAIL_PROVIDER,
			inject: [ConfigService, LoggerService, TracingService],
			useFactory: (
				configService: ConfigService,
				loggerService: LoggerService,
				tracingService: TracingService,
			): EmailTransport => {
				const provider = configService.get("mail.provider");
				loggerService.debug(
					`Notification module: using ${provider ?? "nodemailer"} mail provider`,
				);

				if (provider === "bomboo") {
					const {
						BombooMailNotificationAdapter,
					} = require("./adapters/bomboo-mail-notification.adapter.js");
					return new BombooMailNotificationAdapter(
						configService,
						loggerService,
						tracingService,
					);
				}

				const { NodemailerEmailAdapter } = requireOptional(
					() => require("./adapters/nodemailer-notification.adapter.js"),
					"nodemailer",
					"The default mail provider",
				);
				return new NodemailerEmailAdapter(configService);
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
