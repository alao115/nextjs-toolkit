import { LoggerService } from "../../observability/logger/logger.service";
import {
	NOTIFICATION_PROVIDERS,
	NotificationProvider,
} from "./notification.types";
import { HealthIndicator, HealthIndicatorResult } from "../../health";
import { Inject } from "@nestjs/common";

export interface ProviderHealth {
	provider: string;
	ok: boolean;
	latencyMs?: number;
	error?: string | null;
}

export class NotificationHealthIndicator implements HealthIndicator {
	name = "notification" as const;
	private readonly timeoutMs = 5000;

	constructor(
		private readonly logger: LoggerService,
		@Inject(NOTIFICATION_PROVIDERS)
		private readonly providers: NotificationProvider[],
	) {}

	async check(): Promise<HealthIndicatorResult> {
		const checks = this.providers.map((p) => this.checkProviderWithTimeout(p));
		const results = await Promise.all(checks);
		const ok = results.every((r) => r.ok);
		return { status: ok ? "up" : "down", info: results, name: this.name };
	}

	private async checkProviderWithTimeout(
		provider: NotificationProvider,
	): Promise<ProviderHealth> {
		if (!provider.checkHealth) {
			return { provider: provider.name, ok: true };
		}

		const start = Date.now();
		try {
			const res = await Promise.race([
				provider.checkHealth(),
				new Promise<boolean>((_, rej) =>
					setTimeout(
						() => rej(new Error("health-check-timeout")),
						this.timeoutMs,
					),
				),
			]);
			const latency = Date.now() - start;
			return {
				provider: provider.name,
				ok: Boolean(res),
				latencyMs: latency,
				error: null,
			};
		} catch (err: any) {
			const latency = Date.now() - start;
			this.logger.warn("Provider health check failed", {
				provider: provider.name,
				error: err?.message,
			});
			return {
				provider: provider.name,
				ok: false,
				latencyMs: latency,
				error: err?.message ?? String(err),
			};
		}
	}
}
