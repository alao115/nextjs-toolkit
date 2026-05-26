/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 05 — Feature flags.
 *
 * Shows:
 *  - Dev/test wiring with static config.
 *  - Production wiring with OpenFeature (works with any OpenFeature provider:
 *    LaunchDarkly, GrowthBook, Flagd, Unleash, ConfigCat).
 *  - Deterministic percentage rollouts.
 *  - Kill-switch behavior (adapter errors → safe default).
 */

import { Injectable, Module } from "@nestjs/common";
import {
	FeatureFlagsModule,
	FeatureFlagsService,
	OpenFeatureFlagsAdapter,
} from "@alaska115/nextjs-toolkit/feature-flags";

// ─── Wiring (dev / test) ──────────────────────────────────────────────────

@Module({
	imports: [
		FeatureFlagsModule.forRoot({
			staticConfig: {
				flags: {
					"new-checkout": true,
					"experimental-search": false,
				},
				variants: {
					"checkout-copy": "v2",
					"max-cart-items": 50,
				},
			},
		}),
	],
})
export class FeatureFlagsDevModule {}

// ─── Wiring (production with OpenFeature) ────────────────────────────────

declare const OpenFeature: any; // from `@openfeature/server-sdk`
declare const LaunchDarklyProvider: any; // from `@openfeature/launchdarkly-provider`

export async function bootstrapProductionFlags(): Promise<unknown> {
	OpenFeature.setProvider(
		new LaunchDarklyProvider({ sdkKey: process.env.LAUNCHDARKLY_SDK_KEY }),
	);
	await OpenFeature.providerReady; // wait for initial sync

	const client = OpenFeature.getClient();

	return FeatureFlagsModule.forRoot({
		adapter: new OpenFeatureFlagsAdapter(client),
	});
}

// ─── Usage ────────────────────────────────────────────────────────────────

@Injectable()
export class CheckoutService {
	constructor(private readonly flags: FeatureFlagsService) {}

	async checkout(cartId: string): Promise<void> {
		// Boolean flag — kill switch ensures any adapter error returns false.
		if (await this.flags.isEnabled("new-checkout")) {
			return this.newCheckout(cartId);
		}
		return this.legacyCheckout(cartId);
	}

	async copy(): Promise<string> {
		// Variant with fallback — type-safe via the fallback's runtime type.
		return this.flags.getVariant<string>("checkout-copy", "v1");
	}

	async tryNewSearch(): Promise<boolean> {
		// Deterministic percentage rollout. Same userId always lands in
		// the same bucket — so a 10% rollout consistently picks the same
		// 10% of users across restarts, instances, and request retries.
		//
		// Subject defaults to userId from RequestContext; pass an explicit
		// subject only when the rollout target isn't a user (e.g. tenant).
		return this.flags.inRollout("new-search", 10);
	}

	private async newCheckout(_cartId: string): Promise<void> {
		/* ... */
	}
	private async legacyCheckout(_cartId: string): Promise<void> {
		/* ... */
	}
}

// ─── Anti-patterns to avoid ────────────────────────────────────────────────
//
// ❌ DON'T gate critical safety checks behind flags:
//      if (await flags.isEnabled("validate-payment")) { validate() }
//    Flags drift. The flag will be "fully rolled out" then forgotten and
//    removed years later, taking the validation with it.
//
// ❌ DON'T put PII in the subject:
//      flags.inRollout("new-x", 10, userEmail)
//    The hash is one-way, but the *input* goes to the adapter and may
//    end up logged on their side.
//
// ❌ DON'T change the subject mid-rollout:
//      // week 1
//      flags.inRollout("x", 10, userId)
//      // week 2
//      flags.inRollout("x", 10, tenantId)
//    You re-shuffle who's in the bucket, defeating the whole point of
//    deterministic bucketing.
