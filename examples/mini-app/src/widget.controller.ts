import { Controller, Get, Param } from "@nestjs/common";
import { LoggerService } from "@alaska115/nextjs-toolkit/observability";
import { RequestContextService } from "@alaska115/nextjs-toolkit/context";
import { TenantService } from "@alaska115/nextjs-toolkit/multi-tenancy";
import { FeatureFlagsService } from "@alaska115/nextjs-toolkit/feature-flags";
import {
	retry,
	withTimeout,
} from "@alaska115/nextjs-toolkit/resilience";
import { WidgetMissingException } from "./widget.exception";

@Controller()
export class WidgetController {
	constructor(
		private readonly logger: LoggerService,
		private readonly ctx: RequestContextService,
		private readonly tenant: TenantService,
		private readonly flags: FeatureFlagsService,
	) {}

	/**
	 * Exercises: LoggerService auto-enrichment, RequestContext propagation,
	 * GlobalResponseInterceptor envelope.
	 */
	@Get("hello")
	hello() {
		const ctx = this.ctx.getContext();
		this.logger.info("hello called", { extra: "data" });
		return {
			message: "hello from @alaska115/nextjs-toolkit",
			requestId: ctx?.requestId,
			correlationId: ctx?.correlationId,
			tenantId: ctx?.tenantId ?? null,
		};
	}

	/**
	 * Exercises: TenantService.scopedWhere() / current() / cacheKey().
	 * Pass `x-tenant-id: acme` header to see scoping; omit it to see the
	 * TenantNotSetError pathway.
	 */
	@Get("tenant")
	tenantInfo() {
		return {
			current: this.tenant.current() ?? null,
			cacheKey: this.tenant.cacheKey("user", "42"),
			rateLimitKey: this.tenant.rateLimitKey("api", "GET", "/tenant"),
			scopedWhere: this.tenant.scopedWhere(
				{ status: "active" },
				{ strict: false },
			),
		};
	}

	/**
	 * Exercises: FeatureFlagsService.isEnabled + inRollout (deterministic
	 * bucketing). Try the static flag names "new-checkout" (on) and
	 * "experimental-search" (off) from app.module config.
	 */
	@Get("flag/:name")
	async flag(@Param("name") name: string) {
		return {
			flag: name,
			enabled: await this.flags.isEnabled(name),
			rollout10pct: this.flags.inRollout(name, 10, "demo-subject"),
			rollout50pct: this.flags.inRollout(name, 50, "demo-subject"),
		};
	}

	/**
	 * Exercises: BaseException → HttpExceptionFilter shaping
	 * (status, code, message, details, correlationId).
	 */
	@Get("error")
	error() {
		throw new WidgetMissingException("xyz-789");
	}

	/**
	 * Exercises: retry + withTimeout from the resilience module.
	 * The inner work sometimes fails, sometimes succeeds — retry handles it.
	 */
	@Get("slow")
	async slow() {
		let attempts = 0;
		const result = await retry(
			() =>
				withTimeout(
					new Promise<string>((resolve, reject) => {
						attempts++;
						setTimeout(() => {
							// Fail the first two attempts to demonstrate retry.
							if (attempts < 3) reject(new Error("transient"));
							else resolve("eventually ok");
						}, 50);
					}),
					200,
					"slow-work",
				),
			{ maxRetries: 5, baseBackoffMs: 10, maxBackoffMs: 50, jitterMs: 5 },
		);
		return { result, attempts };
	}
}
