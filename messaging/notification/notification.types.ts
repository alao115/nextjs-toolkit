export const NOTIFICATION_PROVIDERS = Symbol("NOTIFICATION_PROVIDERS");
export const NOTIFICATION_IDEMPOTENCY_STORE = Symbol(
	"NOTIFICATION_IDEMPOTENCY_STORE",
);

export interface NotificationPayload {
	to: string | string[];
	from?: string;
	template?: string;
	html?: string;
	body?: string; // for sms
	data?: Record<string, any>; // dynamic template data
	subject?: string; // for email
}

export type NotificationChannel = "email" | "sms" | "whatsapp";

export interface NotificationContext {
	[key: string]: any;
}

export interface NotificationMessage {
	to: string | string[]; // email or phone
	channel: NotificationChannel;
	templateKey: string; // e.g. 'welcome-email'
	context: NotificationContext;
	subject?: string;
	idempotencyKey?: string;
	correlationId?: string;
}

export interface NotificationResult {
	success: boolean;
	provider: string;
	messageId?: string;
	errorCode?: string;
	errorMessage?: string;
}

export interface NotificationProvider {
	readonly name: string;
	supports(channel: NotificationChannel): boolean;

	/**
	 * Send a message. Implementations must not throw on known send failures;
	 * they should return success=false + errorCode/errorMessage. Throw only on
	 * unexpected infra/runtime exceptions.
	 */
	send(
		message: NotificationMessage,
		rendered: { subject?: string; body: string },
	): Promise<NotificationResult>;

	/**
	 * Optional health check used by health module / readiness.
	 */
	checkHealth?(): Promise<boolean>;
}

export interface NotificationRetryPolicy {
	maxRetries: number;
	baseBackoffMs: number;
	maxBackoffMs: number;
	jitterMs: number; // random jitter to avoid thundering herd
}

export const MAIL_PROVIDER = Symbol("mail-provider");
export const SMS_PROVIDER = Symbol("sms-provider");
export const WHATSAPP_PROVIDER = Symbol("whatsapp-provider");
export const TEMPLATE_ENGINE = Symbol("template-engine");

export interface TemplateDefinition {
	key: string;
	channel: NotificationChannel;
	subject?: string;
	body: string; // can be HTML or text depending on channel
}

export interface TemplateEngineOptions {
	templatesDir?: string;
	preload?: TemplateDefinition[];
}

export interface INotificationTemplateEngine {
	getTemplate(key: string): TemplateDefinition;
	render(
		templateKey: string,
		context: Record<string, any>,
	): {
		subject?: string;
		body: string;
	};
}
