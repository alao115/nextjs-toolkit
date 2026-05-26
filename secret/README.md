# `@alaska115/nextjs-toolkit/secret`

Pluggable secret manager — `LocalSecretManager` for dev/tests, `VaultSecretManager` for production (Vault KV v2 over HTTP, no SDK peer dep). Includes a rotation event emitter and a boot-time canary check.

## Wire it up

```ts
import { SecretsModule } from "@alaska115/nextjs-toolkit/secret";

@Module({ imports: [SecretsModule] })
export class AppModule {}
```

`SecretsModule` is `@Global()`. It dispatches on `kms.provider`:

| `kms.provider` | Adapter chosen | Config needed |
| --- | --- | --- |
| `local` (default) | `LocalSecretManager` | — |
| `vault` | `VaultSecretManager` | `kms.vaultAddr`, `kms.vaultToken` |

If `vault` is set but the addr/token are missing, it warns and falls back to local — never silently boots with an inert manager.

## Read a secret

```ts
import { SECRET_MANAGER, SecretManager } from "@alaska115/nextjs-toolkit/secret";

@Injectable()
export class JwtSigner {
  constructor(@Inject(SECRET_MANAGER) private readonly secrets: SecretManager) {}

  async sign(payload: object) {
    const key = await this.secrets.getRequiredSecret("jwt-signing"); // throws if missing
    return jwt.sign(payload, key);
  }
}
```

`getSecret` returns `string | undefined`; `getRequiredSecret` throws `SecretKeyNotFoundException`. Use the latter inside the code path that genuinely can't proceed without it.

## Versioned secrets + rotation

```ts
import { SecretRotationEmitter } from "@alaska115/nextjs-toolkit/secret";

@Injectable()
export class JwtSigner implements OnModuleInit {
  private cached: string | null = null;

  constructor(
    @Inject(SECRET_MANAGER) private readonly secrets: SecretManager,
    private readonly rotations: SecretRotationEmitter,
  ) {}

  onModuleInit() {
    this.rotations.onRotationOf("jwt-signing", (ev) => {
      this.cached = ev.value.value;
    });
  }
}
```

`VaultSecretManager` emits a rotation event when a re-read returns a higher `version` than the cached one. For cross-instance propagation, fan out through Redis pubsub and call `emitter.emit()` on the receiver.

## Canary check at boot

```ts
import { canaryCheck } from "@alaska115/nextjs-toolkit/secret";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const secrets = app.get<SecretManager>(SECRET_MANAGER);

  const result = await canaryCheck(secrets, ["jwt-signing", "db-encryption"]);
  if (!result.ok) {
    throw new Error(`Secret canary failed: ${JSON.stringify(result)}`);
  }

  await app.listen(3001);
}
```

The check runs **before** `app.listen()` so the orchestrator's readiness probe never sees a half-broken pod.

## Anti-patterns

- **Don't cache secrets indefinitely.** `VaultSecretManager` defaults to a 60s TTL. Override via `cacheTtlMs` per environment.
- **Don't log the secret value, ever.** The rotation event carries `SecretValue` for caller convenience — don't pass it to `LoggerService`.
- **Don't use `LocalSecretManager` in production.** It's intentionally process-local with no setter beyond what your `onModuleInit` populates. There is no path to "make it work" — it's a stub.
