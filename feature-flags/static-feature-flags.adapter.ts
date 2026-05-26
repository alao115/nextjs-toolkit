import { Injectable } from "@nestjs/common";
import {
	FeatureFlagContext,
	FeatureFlagContract,
} from "./feature-flags.contract";

export interface StaticFeatureFlagsConfig {
	flags?: Record<string, boolean>;
	variants?: Record<string, unknown>;
}

/**
 * In-memory feature-flag adapter. Reads from a static config map at module
 * registration time. Suitable for tests and as a stub before a real provider
 * (LaunchDarkly, GrowthBook, Unleash, etc.) is wired up.
 */
@Injectable()
export class StaticFeatureFlagsAdapter implements FeatureFlagContract {
	constructor(private readonly config: StaticFeatureFlagsConfig = {}) {}

	async isEnabled(flag: string, _context?: FeatureFlagContext): Promise<boolean> {
		return this.config.flags?.[flag] ?? false;
	}

	async getVariant<T = unknown>(
		flag: string,
		fallback: T,
		_context?: FeatureFlagContext,
	): Promise<T> {
		const v = this.config.variants?.[flag];
		return (v === undefined ? fallback : v) as T;
	}
}
