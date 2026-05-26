import { Inject, Injectable } from "@nestjs/common";
import {
	FEATURE_FLAGS_PORT,
	FeatureFlagContext,
	FeatureFlagContract,
} from "./feature-flags.contract";
import { isInRolloutBucket } from "./bucketing";
import { LoggerService } from "../observability/logger/logger.service";
import { RequestContextService } from "../context";

@Injectable()
export class FeatureFlagsService {
	constructor(
		@Inject(FEATURE_FLAGS_PORT)
		private readonly impl: FeatureFlagContract,
		private readonly ctx: RequestContextService,
		private readonly logger: LoggerService,
	) {}

	/**
	 * Kill switch: if the underlying provider throws, the flag evaluates to
	 * `false`. Always log the failure — a silent flag flip is worse than a
	 * noisy one.
	 */
	async isEnabled(flag: string, extra?: FeatureFlagContext): Promise<boolean> {
		try {
			return await this.impl.isEnabled(flag, this.contextFor(extra));
		} catch (err) {
			this.logger.error(`FeatureFlags: isEnabled(${flag}) failed — defaulting to false`, {
				error: err,
				flag,
			});
			return false;
		}
	}

	/**
	 * Kill switch: if the underlying provider throws, returns `fallback`.
	 */
	async getVariant<T = unknown>(
		flag: string,
		fallback: T,
		extra?: FeatureFlagContext,
	): Promise<T> {
		try {
			return await this.impl.getVariant<T>(flag, fallback, this.contextFor(extra));
		} catch (err) {
			this.logger.error(
				`FeatureFlags: getVariant(${flag}) failed — using fallback`,
				{ error: err, flag },
			);
			return fallback;
		}
	}

	/**
	 * Deterministic percentage rollout. Same subject + same flag → same answer
	 * across instances and restarts. `subject` defaults to the request's
	 * `userId` → `tenantId` → "anonymous" so unauthenticated traffic still
	 * shards consistently per tenant.
	 */
	inRollout(flag: string, percent: number, subject?: string): boolean {
		const reqCtx = this.ctx.getContext();
		const resolved =
			subject ?? reqCtx?.userId ?? reqCtx?.tenantId ?? "anonymous";
		return isInRolloutBucket(flag, resolved, percent);
	}

	private contextFor(extra?: FeatureFlagContext): FeatureFlagContext {
		const reqCtx = this.ctx.getContext();
		return {
			userId: extra?.userId ?? reqCtx?.userId,
			tenantId: extra?.tenantId ?? reqCtx?.tenantId,
			environment: extra?.environment,
			attributes: extra?.attributes,
		};
	}
}
