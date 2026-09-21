# `secret`

```ts
import {
  SecretsModule,
  SECRET_MANAGER,
  LocalSecretManager,
  VaultSecretManager,
  SecretRotationEmitter,
  canaryCheck,
  type SecretManager, type SecretValue,
  type VaultSecretManagerConfig,
  type SecretRotationEvent, type CanaryCheckResult,
} from "@alaska115/nextjs-toolkit/secret";
```

A `SecretManager` port with a dev-only in-memory implementation, a Vault KV-v2
implementation, rotation events and a boot-time canary check.

## Setup

```ts
@Module({ imports: [SecretsModule] })   // @Global()
export class AppModule {}
```

`SecretsModule` binds `SECRET_MANAGER` from `kms.provider`:

| `KMS_PROVIDER`    | Manager                | Requires                            |
| ----------------- | ---------------------- | ----------------------------------- |
| `vault`           | `VaultSecretManager`   | `VAULT_ADDR` **and** `VAULT_TOKEN`  |
| `local` (default) | `LocalSecretManager`   | —                                   |

> With `KMS_PROVIDER=vault` but either variable missing, the module logs a
> warning and **silently falls back to `LocalSecretManager`** — which holds
> nothing. Assert on that at boot with `canaryCheck` rather than discovering it
> at first use.

`SecretsModule` also provides and exports `SecretRotationEmitter`.

## Using it

```ts
@Injectable()
export class TokenService {
  constructor(@Inject(SECRET_MANAGER) private readonly secrets: SecretManager) {}

  async sign(payload: object) {
    const key = await this.secrets.getRequiredSecret("jwt-signing");
    return jwt.sign(payload, key);
  }
}
```

`SecretManager`:

| Method                        | Behaviour                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| `getSecret(key)`              | Value or `undefined`.                                        |
| `getRequiredSecret(key)`      | Value, or throws `SecretKeyNotFoundException`.               |
| `getVersionedSecret(key)?`    | `{ value, version, rotatedAt? }` — detect rotation without comparing values. |
| `rotateSecret(key)?`          | Optional; neither shipped manager implements it.             |

## `LocalSecretManager`

Process-local `Map`, seeded by hand. Dev and tests only.

```ts
const local = app.get<SecretManager>(SECRET_MANAGER) as LocalSecretManager;
local.setSecret("jwt-signing", process.env.JWT_SECRET!);
```

`version` is the first 12 hex chars of the value's SHA-256, so the same value
always has the same version. `rotateSecret()` throws by design.

## `VaultSecretManager`

```ts
new VaultSecretManager({
  addr: "https://vault.internal:8200",
  token,
  mount: "secret",      // KV v2 mount; default "secret"
  namespace,            // Vault Enterprise
  cacheTtlMs: 60_000,   // default 60s; 0 disables caching
  rotationEmitter,
})
```

Talks to `${addr}/v1/${mount}/data/${key}` over `fetch` — no `node-vault`
dependency. Reads carry Vault's own version number, and when a `rotationEmitter`
is supplied the manager publishes a rotation event the first time it observes a
new version for a key.

Limitations: `rotateSecret()` is not implemented (Vault rotations are usually
driven externally), and the cache is per-process — pair the emitter with Redis
pub/sub if you need fleet-wide invalidation.

## Rotation events

```ts
const unsubscribe = emitter.onRotationOf("db-encryption", (event) => {
  cache.clear();
  logger.warn("secret rotated", { key: event.key, version: event.newVersion });
});
```

| Method                          | Returns                                   |
| ------------------------------- | ------------------------------------------ |
| `emit(event)`                   | —                                          |
| `onRotation(handler)`           | An unsubscribe function.                   |
| `onRotationOf(key, handler)`    | An unsubscribe function, scoped to one key. |
| `getLastVersion(key)`           | The last version seen, or `undefined`.     |

`SecretRotationEvent` = `{ key, previousVersion?, newVersion, rotatedAt, value }`.

## Boot-time canary

```ts
const result = await canaryCheck(secretManager, ["jwt-signing", "db-encryption"]);
if (!result.ok) {
  throw new Error(`Secret canary failed: ${JSON.stringify(result)}`);
}
```

Returns `{ ok, missing: string[], errors: { key, error }[] }`. Run it **before**
`app.listen()` — a service that boots without its secrets and then 500s on the
first authenticated request is worse than one that refuses to start.

See [`examples/08-secrets-vault.ts`](../../examples/08-secrets-vault.ts).
