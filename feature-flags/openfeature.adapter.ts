import { Injectable } from "@nestjs/common";
import {
	FeatureFlagContext,
	FeatureFlagContract,
} from "./feature-flags.contract";

/**
 * Duck-typed subset of the OpenFeature `Client` shape that we actually use.
 * Matches `@openfeature/server-sdk` v1.x. Defined locally so the package
 * doesn't have to pull `@openfeature/server-sdk` as a peer dep.
 */
export interface OpenFeatureClientLike {
	getBooleanValue(
		flag: string,
		defaultValue: boolean,
		context?: Record<string, unknown>,
	): Promise<boolean>;
	getStringValue(
		flag: string,
		defaultValue: string,
		context?: Record<string, unknown>,
	): Promise<string>;
	getNumberValue(
		flag: string,
		defaultValue: number,
		context?: Record<string, unknown>,
	): Promise<number>;
	getObjectValue<T = unknown>(
		flag: string,
		defaultValue: T,
		context?: Record<string, unknown>,
	): Promise<T>;
}

/**
 * Adapter that bridges {@link FeatureFlagContract} → an OpenFeature client.
 * Works with any provider that the consumer has registered with OpenFeature
 * (LaunchDarkly, GrowthBook, Flagd, Unleash, ConfigCat — they all publish
 * OpenFeature providers).
 *
 * Wiring (consumer side):
 *
 * ```ts
 * import { OpenFeature } from "@openfeature/server-sdk";
 * import { OpenFeatureFlagsAdapter } from "@alaska115/nextjs-toolkit/feature-flags";
 *
 * OpenFeature.setProvider(new LaunchDarklyProvider({ sdkKey: ... }));
 * const client = OpenFeature.getClient();
 *
 * @Module({
 *   imports: [
 *     FeatureFlagsModule.forRoot({ adapter: new OpenFeatureFlagsAdapter(client) }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class OpenFeatureFlagsAdapter implements FeatureFlagContract {
	constructor(private readonly client: OpenFeatureClientLike) {}

	async isEnabled(
		flag: string,
		context?: FeatureFlagContext,
	): Promise<boolean> {
		return this.client.getBooleanValue(
			flag,
			false,
			this.toEvaluationContext(context),
		);
	}

	async getVariant<T = unknown>(
		flag: string,
		fallback: T,
		context?: FeatureFlagContext,
	): Promise<T> {
		// Dispatch by the runtime type of the fallback. This matches the
		// OpenFeature SDK's typed accessors — the provider needs to know
		// what kind of value to expect.
		switch (typeof fallback) {
			case "boolean":
				return (await this.client.getBooleanValue(
					flag,
					fallback as boolean,
					this.toEvaluationContext(context),
				)) as unknown as T;
			case "string":
				return (await this.client.getStringValue(
					flag,
					fallback as string,
					this.toEvaluationContext(context),
				)) as unknown as T;
			case "number":
				return (await this.client.getNumberValue(
					flag,
					fallback as number,
					this.toEvaluationContext(context),
				)) as unknown as T;
			default:
				return this.client.getObjectValue<T>(
					flag,
					fallback,
					this.toEvaluationContext(context),
				);
		}
	}

	private toEvaluationContext(
		context?: FeatureFlagContext,
	): Record<string, unknown> {
		if (!context) return {};
		// OpenFeature conventions: `targetingKey` identifies the subject.
		// Prefer userId, fall back to tenantId.
		const targetingKey = context.userId ?? context.tenantId;
		return {
			...(targetingKey ? { targetingKey } : {}),
			...(context.userId ? { userId: context.userId } : {}),
			...(context.tenantId ? { tenantId: context.tenantId } : {}),
			...(context.environment ? { environment: context.environment } : {}),
			...(context.attributes ?? {}),
		};
	}
}
