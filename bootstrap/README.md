# `@alaska115/nextjs-toolkit/bootstrap`

Boot-time wiring helpers — CORS, Helmet, Content Security Policy, Express sessions, Swagger, ngrok proxy. Each helper is a pure function you call from `main.ts` after `NestFactory.create()`.

## Use it

```ts
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import {
  corsRegistration,
  helmetRegistration,
  contentSecurityPolicyRegistration,
  expressSessionRegistration,
  registerSwagger,
  SetupNgrokProxyModule,
  defaultRegistration,
} from "@alaska115/nextjs-toolkit/bootstrap";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  defaultRegistration(app);                     // global pipes, prefix, version
  corsRegistration(app, config);
  helmetRegistration(app);
  contentSecurityPolicyRegistration(app);       // strict CSP, per-request nonce
  expressSessionRegistration(app, config);
  registerSwagger({
    enabled: config.get<boolean>("swagger.enabled") === true,
    app,
    config,
  });
  SetupNgrokProxyModule.setup({                  // dev only
    enabled: config.get<string>("app.env") !== "production"
      && config.get<boolean>("ngrok.enabled") === true,
    config,
  });

  await app.listen(config.get<number>("http.port") ?? 3001);
}
bootstrap();
```

## Defaults you should know

- **CORS** is opt-in via `cors.enabled`. Origin, methods, and exposed headers come from `cors.*` config keys.
- **CSP** ships a strict default: `default-src 'none'`, scripts nonce-only, no third-party CDN allowlist baked in. Wrap or fork the helper if your app loads from a CDN (it should declare which one, not inherit a permissive default from us).
- **Swagger** runs only when the caller passes `enabled: true` to `registerSwagger({ enabled, app, config })`. When enabled, it **requires** `swagger.title` and `swagger.version` to be set — throws at boot if either is missing. The previous behavior of reading `swagger.enabled` from config + silently defaulting title/version was removed in 0.6.0. The OpenAPI document is mounted at `${http.globalPrefix}/docs`. When `app.generateAPIDocs === "true"`, the spec is also written to `swagger.outputPath` (defaults to `./swagger.json`).
- **ngrok** runs only when the caller passes `enabled: true` to `SetupNgrokProxyModule.setup({ enabled, config })`. When enabled, it **requires** `http.port`, `ngrok.token`, and `ngrok.domain` to be set — throws at boot if any are missing. The previous silent-no-op-in-production guard was removed in 0.5.0; the caller owns the production decision now.

## Anti-patterns

- **Don't replace `defaultRegistration` with a no-op.** It registers the global `ValidationPipe`. Skipping it means your DTO `@IsEmail()` annotations don't fire.
- **Don't loosen the default CSP "just to make Swagger work."** Open the CSP for Swagger's `/docs` route only — the API endpoints below it should keep the strict default.
- **Don't pass `enabled: true` to ngrok in any environment you don't want publicly exposed.** As of 0.5.0 the caller — not the package — decides whether ngrok runs. Gate on `config.get("app.env") !== "production"` explicitly.
