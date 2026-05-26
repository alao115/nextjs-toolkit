# `@alaska115/nextjs-toolkit/feature-flags`

Pluggable feature flags. The package ships a static adapter for tests and a deterministic percentage-bucketing helper — bring your own LaunchDarkly/GrowthBook/Unleash adapter for production.

## Wire it up

```ts
import { FeatureFlagsModule } from "@alaska115/nextjs-toolkit/feature-flags";

@Module({
  imports: [
    FeatureFlagsModule.forRoot({
      staticConfig: {
        flags: { "new-checkout": true, "experimental-search": false },
        variants: { "checkout-copy": "v2" },
      },
    }),
  ],
})
export class AppModule {}
```

For production, supply a real adapter:

```ts
FeatureFlagsModule.forRoot({ adapter: new LaunchDarklyAdapter(...) })
```

## Use it

```ts
constructor(private readonly flags: FeatureFlagsService) {}

async checkout() {
  if (await this.flags.isEnabled("new-checkout")) { ... }

  const copy = await this.flags.getVariant<string>("checkout-copy", "v1");

  // Deterministic % rollout — same subject always lands in the same bucket
  if (this.flags.inRollout("new-search", 10)) {
    // Roughly 10% of users see this branch, consistently across restarts and instances
  }
}
```

`isEnabled` / `getVariant` **auto-inject** `userId` + `tenantId` from the active `RequestContext` so adapters can do targeted rollouts without the caller passing them.

## Kill switch

`isEnabled` and `getVariant` **never throw**. If the underlying adapter errors:
- `isEnabled` returns `false`
- `getVariant` returns the `fallback` you provided

The error is logged via `LoggerService.error()` so a misconfigured flag provider doesn't go silent.

## Deterministic bucketing

`inRollout(flag, percent, subject?)` hashes `(flag, subject)` to a 32-bit number and compares against `percent/100`. Same subject + same flag → same answer across instances, restarts, and replays. Subject defaults to `userId` → `tenantId` → `"anonymous"`.

```ts
import { isInRolloutBucket } from "@alaska115/nextjs-toolkit/feature-flags";

isInRolloutBucket("flag-a", "user-42", 25); // true/false, but always the same answer
```

## Anti-patterns

- **Don't gate critical safety checks behind flags.** Flags drift — what was "fully rolled out" gets forgotten and removed. If something must always be on, it's not a feature flag.
- **Don't put PII in the `subject`.** The hash is one-way, but the input gets sent to the adapter. Use `userId`, not `email`.
- **Don't change `subject` mid-rollout** (e.g. switching from `userId` to `tenantId`). You'll re-shuffle who's in the bucket, defeating the determinism.
