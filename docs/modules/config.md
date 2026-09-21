# `config`

```ts
import {
  ConfigurationModule,
  ConfigurationHelpersService,
  configValidationSchema,
} from "@alaska115/nextjs-toolkit/config";
```

Wraps `@nestjs/config` with a Joi-validated env schema and a pre-built config
tree. Import it **first** in your `AppModule` — every other module in the
toolkit reads its settings through `ConfigService`.

## Setup

```ts
@Module({
  imports: [ConfigurationModule], // @Global() — ConfigService is available everywhere
})
export class AppModule {}
```

`ConfigurationModule` calls `ConfigModule.forRoot()` with:

| Setting            | Value                                     |
| ------------------ | ----------------------------------------- |
| `isGlobal`         | `true`                                    |
| `load`             | the package's `configuration()` factory   |
| `validationSchema` | `configValidationSchema` (Joi)            |
| `allowUnknown`     | `true` — your own env vars pass through   |
| `abortEarly`       | `false` — reports every invalid var at once |
| `envFilePath`      | `[".env", ".env.local"]`                  |

Invalid env vars fail the boot with a single aggregated Joi error.

## Exports

| Export                        | Kind    | Description                                                                 |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `ConfigurationModule`         | module  | Global module described above.                                              |
| `ConfigurationHelpersService` | service | `isAuthEnabled` getter, `getNativeConfigInstance` escape hatch to `ConfigService`. |
| `configValidationSchema`      | Joi     | The raw schema — extend it when you add your own env vars.                  |

```ts
@Injectable()
export class SomeService {
  constructor(private readonly helpers: ConfigurationHelpersService) {}

  doThing() {
    if (this.helpers.isAuthEnabled) { /* ... */ }
    const raw = this.helpers.getNativeConfigInstance; // plain ConfigService
  }
}
```

## Adding your own env vars

`allowUnknown: true` means unknown vars reach `process.env` untouched, but they
aren't validated and aren't in the config tree. To get both, register a second
`ConfigModule.forRoot()` with your own `load` factory and a schema that extends
the package's:

```ts
import * as Joi from "joi";
import { ConfigModule } from "@nestjs/config";
import { configValidationSchema } from "@alaska115/nextjs-toolkit/config";

const mySchema = configValidationSchema.keys({
  STRIPE_SECRET_KEY: Joi.string().required(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({ stripe: { secretKey: process.env.STRIPE_SECRET_KEY } })],
      validationSchema: mySchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
})
export class AppModule {}
```

Two config namespaces are **read by the toolkit but not produced by its own
config factory** — you must supply them yourself if you use those features:

- `swagger.*` — required by [`registerSwagger`](./bootstrap.md#registerswagger).
- `persistence.*` — read by [`buildPersistenceConfig`](./persistence.md#buildpersistenceconfig).

See the [configuration reference](../configuration.md) for every env var and
config key the package understands.
