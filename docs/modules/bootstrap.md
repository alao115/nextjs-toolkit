# `bootstrap`

```ts
import {
  registerDefaults,
  corsRegistration,
  helmetRegistration,
  contentSecurityPolicyRegistration,
  registerExpressSession,
  registerSwagger,
  registerShutdownAppHook,
  SetupNgrokProxyModule,
  type RegisterSwaggerOptions,
  type SetupNgrokProxyOptions,
} from "@alaska115/nextjs-toolkit/bootstrap";
```

Boot-time `main.ts` helpers. These are plain functions that take the
`INestApplication` (and usually `ConfigService`) — not modules. Call the ones
you want, in the order you want.

## Typical `main.ts`

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import {
  registerDefaults,
  corsRegistration,
  helmetRegistration,
  registerSwagger,
  registerShutdownAppHook,
  SetupNgrokProxyModule,
} from "@alaska115/nextjs-toolkit/bootstrap";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  registerDefaults(app, config);       // prefix, versioning, body limits, ValidationPipe
  corsRegistration(app, config);
  helmetRegistration(app);
  registerShutdownAppHook(app);        // needs ShutdownModule in the app tree

  registerSwagger({
    enabled: config.get<boolean>("swagger.enabled") === true,
    app,
    config,
  });

  SetupNgrokProxyModule.setup({
    enabled: config.get<boolean>("ngrok.enabled") === true,
    config,
  });

  await app.listen(config.get<number>("http.port") ?? 3001);
}
bootstrap();
```

## API

### `registerDefaults(app, configService)`

The opinionated baseline:

- `app.setGlobalPrefix(config.http.globalPrefix ?? "api")`
- URI versioning with `defaultVersion = config.http.apiVersion ?? "1"`
- `express.json` and `express.urlencoded` capped at **1 MB**
- A global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`,
  `transform: true`, `transformOptions.enableImplicitConversion: true`

> Because `forbidNonWhitelisted` is on, any request body property not declared
> on your DTO is a 400. That is deliberate; skip `registerDefaults` and wire
> your own pipe if you want looser behaviour.

### `corsRegistration(app, configService)`

No-op when `cors.enabled` is falsy. Otherwise enables CORS with
`origin: config.cors.origin`, methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`,
`credentials: true`, and `X-Request-ID` exposed to the browser.

### `helmetRegistration(app)`

Helmet with a hardened preset — `referrerPolicy: no-referrer`,
`frameguard: deny`, HSTS for 180 days with subdomains, `noSniff`,
COOP/CORP `same-origin`, a minimal CSP (`default-src 'self'`,
`script-src 'self'`, `object-src 'none'`), and `xssFilter` disabled (the legacy
`X-XSS-Protection` header is harmful on modern browsers).

It then adds `Origin-Agent-Cluster`, a no-store `Cache-Control` set, and a
restrictive `Permissions-Policy`.

### `contentSecurityPolicyRegistration(app)`

A stricter, per-request CSP than the helmet default: generates a nonce
(exposed on `res.locals.cspNonce`) and sets `default-src 'none'`,
`script-src 'self' 'nonce-…'`, `frame-ancestors 'none'`, `form-action 'self'`.

Call it **after** `helmetRegistration` — the later middleware wins, since it
overwrites the `Content-Security-Policy` header.

### `registerExpressSession(app, configService)` → `Promise<void>`

Mounts `express-session` backed by a Redis store (`connect-redis` + the `redis`
client). Reads `redis.url`, `auth.cookie.secret`, `auth.cookie.secure`,
`auth.cookie.sameSite`, `auth.cookie.domain`. Cookies are `httpOnly`;
`resave` and `saveUninitialized` are off.

Requires a reachable Redis — it `await`s `redisClient.connect()`.

### `registerSwagger(options)`

```ts
registerSwagger({ enabled: boolean, app: INestApplication, config: ConfigService });
```

`enabled: false` is a complete no-op. When enabled it **throws** unless both
`swagger.title` and `swagger.version` are set on `ConfigService`. Optional keys:
`swagger.description` (`""`), `swagger.server` (`"/"`), `swagger.outputPath`
(`"./swagger.json"`).

Docs are mounted at `` `${http.globalPrefix ?? "api"}/docs` ``. The document
includes bearer auth and a global optional `X-Session-Id` header parameter. When
`app.generateAPIDocs` is truthy (`GENERATE_API_DOCS=true`), the OpenAPI JSON is
also written to `swagger.outputPath`.

> `swagger.*` is not part of the package's own config factory — add those keys
> via your own `ConfigModule.forRoot({ load: [...] })`. See
> [`config`](./config.md#adding-your-own-env-vars).

### `registerShutdownAppHook(app)`

Resolves `ShutdownManager` from the app and registers a hook
(`name: "shutdown-app"`, phase `stopTraffic`, order `10`) that calls
`app.close()`. Requires [`ShutdownModule`](./shutdown.md) in the module tree.

### `SetupNgrokProxyModule.setup(options)`

```ts
SetupNgrokProxyModule.setup({ enabled: boolean, config: ConfigService });
```

`enabled: false` is a no-op. When enabled it validates `http.port` and
`ngrok.token` and **throws** if either is missing. `ngrok.domain` is optional —
set it to bind a reserved domain, omit it for a random `*.ngrok-free.app`
subdomain. The tunnel is opened asynchronously; the URL is logged to stdout.

Requires the optional peer dependency `@ngrok/ngrok`.

> Since 0.5.0 there is no implicit "skip in production" behaviour — the caller
> owns the `enabled` decision.

## Also exported

`OpenApiModule` and the `ApiVersions` enum live in this folder but are **not**
re-exported from the subpath entrypoint. Use `registerSwagger` instead.
