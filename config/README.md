# `@alaska115/nextjs-toolkit/config`

Boot-time configuration: `@nestjs/config` + Joi validation + a flat object loader. Validates every env var the package reads at startup; consumers can extend the schema for their own variables.

See **[ADR 0003](../docs/adr/0003-config-via-joi-no-secret-defaults.md)** for the no-literal-default-secrets policy.

## Wire it up

```ts
import { ConfigurationModule } from "@alaska115/nextjs-toolkit/config";

@Module({ imports: [ConfigurationModule] })
export class AppModule {}
```

`ConfigurationModule` is `@Global()`. It calls `ConfigModule.forRoot()` for you with:
- `validationSchema: configValidationSchema` (the Joi schema, always on)
- `validationOptions: { allowUnknown: true, abortEarly: false }` — extends with consumer env vars cleanly, reports all errors at once
- `envFilePath: [".env", ".env.local"]`

## Read config

```ts
import { ConfigService } from "@nestjs/config";

@Injectable()
export class UserService {
  constructor(private readonly config: ConfigService) {}

  async signToken(payload: object) {
    const secret = this.config.get<string>("auth.jwt.secret");
    if (!secret) throw new Error("JWT secret not configured");
    // ...
  }
}
```

Config layout is documented inline in [`configuration.ts`](./configuration.ts). Top-level keys: `app`, `auth`, `cors`, `db`, `files`, `http`, `kafka`, `kms`, `logging`, `mail`, `minio`, `ngrok`, `nodeEnv`, `observability`, `otp`, `redis`, `rmq`, `sms`.

## Extend the schema

```ts
import * as Joi from "joi";
import { configValidationSchema } from "@alaska115/nextjs-toolkit/config";

const myAppSchema = configValidationSchema.append({
  MY_FEATURE_TOKEN: Joi.string().required(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [myAppConfig],
      validationSchema: myAppSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
})
export class AppModule {}
```

(In that case **don't** import the package's `ConfigurationModule` — you're replacing it.)

## Anti-patterns

- **Don't read `process.env` directly in business code.** Inject `ConfigService` so values are validated and mockable.
- **Don't hardcode literal-default secrets.** See ADR 0003 — if `JWT_SECRET` isn't set, let the JWT library throw at first use rather than silently signing with `"secret"`.
- **Don't put service-specific env vars (`IDENTITY_LAYER_DATABASE_URL`) in this package's schema.** Use `DATABASE_URL` here, alias in the consumer.
