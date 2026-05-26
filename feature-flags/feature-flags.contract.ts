/**
 * Evaluation context for a feature flag. Adapters can use any of these fields
 * (or extra `attributes`) to drive percentage rollouts, A/B tests, etc.
 */
export interface FeatureFlagContext {
	userId?: string;
	tenantId?: string;
	environment?: string;
	attributes?: Record<string, unknown>;
}

export interface FeatureFlagContract {
	/** Returns the boolean value of `flag` for the given context. */
	isEnabled(flag: string, context?: FeatureFlagContext): Promise<boolean>;
	/** Returns a typed variant value (string/number/bool/object) or fallback. */
	getVariant<T = unknown>(
		flag: string,
		fallback: T,
		context?: FeatureFlagContext,
	): Promise<T>;
}

export const FEATURE_FLAGS_PORT = Symbol("FEATURE_FLAGS_PORT");
