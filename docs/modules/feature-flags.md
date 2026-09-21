# `feature-flags`

> **Experimental** — the API may change before 1.0.

```ts
import {
  FeatureFlagsModule, FeatureFlagsService,
  StaticFeatureFlagsAdapter, OpenFeatureFlagsAdapter,
  isInRolloutBucket, FEATURE_FLAGS_PORT,
  type FeatureFlagContract, type FeatureFlagContext,
  type FeatureFlagsModuleOptions, type StaticFeatureFlagsConfig,
  type OpenFeatureClientLike,
} from "@alaska115/nextjs-toolkit/feature-flags";
```

A two-method flag port with a static adapter for dev/tests, an OpenFeature
bridge for production, and deterministic percentage bucketing.

## Setup

```ts
// dev / tests — inline config
FeatureFlagsModule.forRoot({
  staticConfig: {
    flags: { "new-checkout": true, "experimental-search": false },
    variants: { "checkout-copy": "v2" },
  },
})

// production — any OpenFeature client
FeatureFlagsModule.forRoot({
  adapter: new OpenFeatureFlagsAdapter(OpenFeature.getClient()),
})
```

`adapter` takes an **instance** (not a class) and wins over `staticConfig`. With
neither, you get an empty `StaticFeatureFlagsAdapter` — every flag is off and
every variant falls back.

`forRoot()` exports `FeatureFlagsService`.

## `FeatureFlagsService`

```ts
await flags.isEnabled("new-checkout");                       // boolean
await flags.getVariant("checkout-copy", "v1");               // typed fallback
flags.inRollout("new-checkout", 25);                         // synchronous, 25%
flags.inRollout("new-checkout", 25, someExplicitSubjectId);  // custom subject
```

`isEnabled` and `getVariant` build a `FeatureFlagContext` from the
[request context](./context.md) — `userId`, `tenantId` — and merge in anything
you pass as the `extra` argument. Both swallow adapter errors, log them, and
return the safe value (`false` / the fallback), so a flag-provider outage never
takes the request path down.

## Percentage rollouts

```ts
isInRolloutBucket(flag, subject, percent): boolean
```

Hashes `flag + subject` into a bucket in `[0, 100)` and returns whether it falls
under `percent`. Deterministic and stable: the same subject always gets the same
answer for the same flag, so a user doesn't flip between variants on refresh.
Different flags reshuffle independently, so a user unlucky in one rollout isn't
unlucky in all of them.

`FeatureFlagsService.inRollout(flag, percent, subject?)` defaults the subject to
the context `userId`, then `tenantId`, then the literal `"anonymous"` — so
unauthenticated traffic still shards consistently per tenant. It is
**synchronous** and never touches the adapter; use it for gradual rollouts of
code you already shipped.

`percent` is 0–100 inclusive; `0` is never, `100` is always.

## Adapters

### `StaticFeatureFlagsAdapter`

```ts
new StaticFeatureFlagsAdapter({ flags: {...}, variants: {...} })
```

Reads from a plain object. No network, no caching, no reload.

### `OpenFeatureFlagsAdapter`

```ts
new OpenFeatureFlagsAdapter(client)
```

`client` is anything matching `OpenFeatureClientLike` — `getBooleanValue`,
`getStringValue`, `getNumberValue`, `getObjectValue`. That covers the real
OpenFeature JS client and lets you hand-roll a fake in tests without pulling the
SDK in. `getVariant` picks the right typed getter from the fallback's runtime
type.

## Your own adapter

```ts
export class LaunchDarklyAdapter implements FeatureFlagContract {
  async isEnabled(flag: string, ctx?: FeatureFlagContext) { /* ... */ }
  async getVariant<T>(flag: string, fallback: T, ctx?: FeatureFlagContext) { /* ... */ }
}

FeatureFlagsModule.forRoot({ adapter: new LaunchDarklyAdapter(client) })
```

See [`examples/05-feature-flags.ts`](../../examples/05-feature-flags.ts).
