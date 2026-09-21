import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	INotificationTemplateEngine,
	NOTIFICATION_IDEMPOTENCY_STORE,
	NOTIFICATION_PROVIDERS,
	NotificationMessage,
	NotificationProvider,
	NotificationResult,
	NotificationRetryPolicy,
	TEMPLATE_ENGINE,
} from "./notification.types";
import { LoggerService } from "../../observability/logger/logger.service";
import { TracingService } from "../../observability/tracing/tracing.service";

/** Minimal shapes this service needs from prom-client. */
interface SendCounter {
	inc(labels: Record<string, string>): void;
}
interface DurationHistogram {
	startTimer(labels: Record<string, string>): () => void;
}

const NOOP_COUNTER: SendCounter = { inc: () => {} };
const NOOP_HISTOGRAM: DurationHistogram = { startTimer: () => () => {} };

/**
 * `prom-client` is an optional peer dependency. Build the metrics if it is
 * installed, otherwise fall back to no-ops: a missing metrics library must not
 * stop notifications from being sent.
 *
 * Note these register on prom-client's *default* registry, while
 * `PrometheusMetricsAdapter` exports its own — so they do not appear at
 * `/metrics`. See docs/modules/messaging.md.
 */
function buildMetrics(): {
	counter: SendCounter;
	histogram: DurationHistogram;
} {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { Counter, Histogram } = require("prom-client");
		return {
			counter: new Counter({
				name: "notifications_send_total",
				help: "Total notification send attempts",
				labelNames: ["channel", "provider", "success"],
			}),
			histogram: new Histogram({
				name: "notifications_send_duration_seconds",
				help: "Notification send duration",
				labelNames: ["channel", "provider"],
			}),
		};
	} catch {
		return { counter: NOOP_COUNTER, histogram: NOOP_HISTOGRAM };
	}
}

/**
 * Runs `fn` with `span` installed as the active OpenTelemetry context, so
 * anything the provider instruments nests under it. `@opentelemetry/api` is an
 * optional peer dependency; without it the span is still recorded via
 * TracingService, we just cannot propagate ambient context.
 */
function withActiveSpan<T>(span: unknown, fn: () => Promise<T>): Promise<T> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { context, trace } = require("@opentelemetry/api");
		const scoped = trace.setSpan(context.active(), span as any);
		return context.with(scoped, fn);
	} catch {
		return fn();
	}
}

const DEFAULT_RETRY_POLICY: NotificationRetryPolicy = {
	maxRetries: 3,
	baseBackoffMs: 500,
	maxBackoffMs: 4000,
	jitterMs: 250,
};

export interface IdempotencyStore {
	/**
	 * Returns previously stored result if exists.
	 */
	get(idempotencyKey: string): Promise<NotificationResult | null>;

	/**
	 * Store result for idempotencyKey; should be idempotent itself.
	 */
	set(idempotencyKey: string, result: NotificationResult): Promise<void>;
}

@Injectable()
export class NotificationService {
	private readonly sendCounter: SendCounter;
	private readonly durationHistogram: DurationHistogram;

	constructor(
		private readonly tracer: TracingService,
		private readonly logger: LoggerService,
		@Inject(TEMPLATE_ENGINE)
		private readonly templateEngine: INotificationTemplateEngine,
		@Inject(NOTIFICATION_PROVIDERS)
		private readonly providers: NotificationProvider[],
		@Optional()
		@Inject(NOTIFICATION_IDEMPOTENCY_STORE)
		private readonly idempotencyStore?: IdempotencyStore,
	) {
		const metrics = buildMetrics();
		this.sendCounter = metrics.counter;
		this.durationHistogram = metrics.histogram;
	}

	private selectProvider(
		channel: NotificationMessage["channel"],
	): NotificationProvider {
		const provider = this.providers.find((p) => p.supports(channel));
		if (!provider) {
			throw new Error(
				`No notification provider registered for channel: ${channel}`,
			);
		}
		return provider;
	}

	private async checkIdempotency(
		msg: NotificationMessage,
	): Promise<NotificationResult | null> {
		if (!this.idempotencyStore || !msg.idempotencyKey) return null;
		return this.idempotencyStore.get(msg.idempotencyKey);
	}

	private async storeIdempotentResult(
		msg: NotificationMessage,
		result: NotificationResult,
	): Promise<void> {
		if (!this.idempotencyStore || !msg.idempotencyKey) return;
		await this.idempotencyStore.set(msg.idempotencyKey, result);
	}

	async send(
		message: NotificationMessage,
		retryPolicy: Partial<NotificationRetryPolicy> = {},
	): Promise<NotificationResult> {
		return this.tracer.runInSpan("NotificationService.send", async () => {
			const existing = await this.checkIdempotency(message);
			if (existing) {
				return existing;
			}

			const policy: NotificationRetryPolicy = {
				...DEFAULT_RETRY_POLICY,
				...retryPolicy,
			};
			const provider = this.selectProvider(message.channel);

			const labelsBase = {
				channel: message.channel,
				provider: provider.name,
			} as const;

			const rendered = this.templateEngine.render(
				message.templateKey,
				message.context as Record<string, unknown>,
			);

			const span = this.tracer.startSpan("notification.send", {
				attributes: {
					channel: message.channel,
					provider: provider.name,
					templateKey: message.templateKey,
					correlationId: message.correlationId ?? "",
				},
			});

			const endTimer = this.durationHistogram.startTimer(labelsBase);

			let attempt = 0;
			let lastResult: NotificationResult = {
				success: false,
				provider: provider.name,
				errorCode: "UNKNOWN",
				errorMessage: "Unknown error",
			};

			try {
				return await withActiveSpan(span, async () => {
					while (attempt <= policy.maxRetries) {
						attempt++;
						try {
							const result = await provider.send(message, {
								body: rendered.body,
								subject: rendered.subject || message.subject,
							});
							lastResult = result;

							this.sendCounter.inc({
								...labelsBase,
								success: String(result.success),
							});

							if (!result.success && attempt <= policy.maxRetries) {
								const delay = this.computeDelay(attempt, policy);
								this.logger.warn(
									`Notification send failed (attempt ${attempt}/${policy.maxRetries}) – retrying in ${delay}ms`,
									{
										channel: message.channel,
										provider: provider.name,
										errorCode: result.errorCode,
									},
								);
								await this.sleep(delay);
								continue;
							}

							if (!result.success) {
								span.setAttribute("notification.failed", true);
								if (result.errorCode)
									span.setAttribute("notification.errorCode", result.errorCode);
								if (result.errorMessage)
									span.setAttribute(
										"notification.errorMessage",
										result.errorMessage,
									);
							}

							await this.storeIdempotentResult(message, result);
							return result;
						} catch (err: any) {
							this.logger.error(
								`Notification provider error (attempt ${attempt}/${policy.maxRetries})`,
								{
									channel: message.channel,
									provider: provider.name,
									error: err?.message,
								},
							);

							this.sendCounter.inc({
								...labelsBase,
								success: "false",
							});

							if (attempt >= policy.maxRetries) {
								span.setAttribute("notification.failed", true);
								span.recordException(err);
								lastResult = {
									success: false,
									provider: provider.name,
									errorCode: "PROVIDER_EXCEPTION",
									errorMessage: err?.message ?? "Provider threw exception",
								};
								await this.storeIdempotentResult(message, lastResult);
								return lastResult;
							}

							const delay = this.computeDelay(attempt, policy);
							await this.sleep(delay);
						}
					}

					// Fallback, should not be reached logically
					await this.storeIdempotentResult(message, lastResult);
					return lastResult;
				});
			} finally {
				endTimer();
				span.end();
			}
		});
	}

	private computeDelay(
		attempt: number,
		policy: NotificationRetryPolicy,
	): number {
		const base = Math.min(policy.baseBackoffMs * attempt, policy.maxBackoffMs);
		const jitter = Math.floor(Math.random() * policy.jitterMs);
		return base + jitter;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
