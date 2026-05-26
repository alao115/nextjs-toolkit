# Contributing to `@alaska115/nextjs-toolkit`

Read [ADR 0001–0004](./docs/adr/) before making structural changes — they capture the load-bearing decisions and the why behind them.

## Quick start

```bash
pnpm install
pnpm --filter @alaska115/nextjs-toolkit run build
pnpm --filter @alaska115/nextjs-toolkit run test
```

## Conventional Commits

Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). The leading type drives the changelog and the next version bump:

| Type        | Bump  | Use for                                                              |
| ----------- | ----- | -------------------------------------------------------------------- |
| `feat:`     | minor | A new module, a new public method, a new option.                     |
| `fix:`      | patch | A bug fix.                                                           |
| `perf:`     | patch | Faster code that doesn't change behavior.                            |
| `refactor:` | patch | Internal-only restructure (no public API change).                    |
| `docs:`     | patch | Docs only.                                                           |
| `test:`     | patch | Tests only.                                                          |
| `build:`    | patch | Tooling / `tsconfig` / package.json.                                 |
| `ci:`       | patch | CI config.                                                           |
| `chore:`    | patch | Anything else.                                                       |

A `!` after the type (e.g. `feat!:` or `fix!:`) or a `BREAKING CHANGE:` footer marks a major bump. Always include the `BREAKING CHANGE:` footer with a migration note when bumping major — that text lands in the changelog verbatim.

The repo includes a `commitlint.config.js` that enforces this. Wire it via Husky in your local clone:

```bash
pnpm dlx husky-init
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

## Deprecation policy

We follow [Semantic Versioning](https://semver.org/) strictly. Removing a public API requires:

1. **Mark `@deprecated` in JSDoc** with a one-line explanation and the replacement.
2. **Ship the deprecation in a minor release.** Document it in `CHANGELOG.md` under "Deprecated".
3. **Wait at least one minor release** (one calendar quarter, whichever is longer) before removing.
4. **Remove in the next major release.** Document under "Removed" with the same migration note.

```ts
/**
 * @deprecated since 0.4 — use `FeatureFlagsService.inRollout()` instead.
 *   Removed in 1.0.
 */
isUserInBucket(...) { ... }
```

Pre-1.0 (current state): the contract is "we'll try not to break you across minor versions, but a `0.x` bump may include a small breaking change. Read the changelog." Modules under `@experimental` (audit, feature-flags, outbox, rate-limit, resilience, multi-tenancy) can change shape without a major bump until 1.0.

## API stability tiers

| Tier             | Where it lives                                | Stability promise          |
| ---------------- | --------------------------------------------- | -------------------------- |
| **Stable**       | Modules whose `index.ts` is **not** marked `@experimental`. | Breaking changes require a major bump and one minor's worth of deprecation. |
| **Experimental** | Modules whose `index.ts` JSDoc says `@experimental`. | API may change between any two minor releases pre-1.0. Pin a minor version if you depend on shape. |
| **`@internal`**  | Items JSDoc-tagged `@internal`.               | No stability promise. Don't import.                  |

When in doubt, mark new APIs `@experimental` until at least one external consumer has used them in production for a release cycle.

## Code conventions

- **`Symbol` for DI tokens.** Never string literals. See [ADR 0002](./docs/adr/0002-symbol-di-tokens.md).
- **One port + one default adapter per external concern.** See [ADR 0001](./docs/adr/0001-port-adapter-everywhere.md).
- **No literal secret defaults.** See [ADR 0003](./docs/adr/0003-config-via-joi-no-secret-defaults.md).
- **`node:` prefix on built-in imports**: `import { randomUUID } from "node:crypto"`, not `"crypto"`.
- **No `crypto.randomUUID()` (global)** — bare global access breaks on Node 18.0–18.18. Always import explicitly.
- **Heavy SDKs are lazy-required inside their factory.** Don't import `@opentelemetry/sdk-node` at module top level.

## Pull request checklist

- [ ] Conventional Commits message
- [ ] `pnpm --filter @alaska115/nextjs-toolkit build` clean (strictNullChecks + noImplicitAny on)
- [ ] `pnpm --filter @alaska115/nextjs-toolkit test` passes
- [ ] CHANGELOG.md updated (Added / Changed / Deprecated / Removed / Fixed)
- [ ] If you added a public module: registered it in `package.json` `exports`, exported it from `index.ts`, added a `README.md` to the module dir, and either marked it `@experimental` or got a maintainer's sign-off on stable-from-day-one
- [ ] If you removed a public API: deprecation period observed (see above)
- [ ] If you changed a DI token's *shape*, even with the same symbol: that's a breaking change
