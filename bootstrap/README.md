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
  registerSwagger(app, config);
  SetupNgrokProxyModule.setup(config);          // dev only

  await app.listen(config.get<number>("http.port") ?? 3001);
}
bootstrap();
```

## Defaults you should know

- **CORS** is opt-in via `cors.enabled`. Origin, methods, and exposed headers come from `cors.*` config keys.
- **CSP** ships a strict default: `default-src 'none'`, scripts nonce-only, no third-party CDN allowlist baked in. Wrap or fork the helper if your app loads from a CDN (it should declare which one, not inherit a permissive default from us).
- **Swagger** writes to `./swagger.json` (override with `swagger.outputPath`) when `app.generateAPIDocs === "true"`. The OpenAPI document is mounted at `${http.globalPrefix}/docs`.
- **ngrok** only runs when `NODE_ENV !== "production"` AND `ngrok.enabled === true`. It logs the ingress URL to `console.log` (the only place in the package that does).

## Anti-patterns

- **Don't replace `defaultRegistration` with a no-op.** It registers the global `ValidationPipe`. Skipping it means your DTO `@IsEmail()` annotations don't fire.
- **Don't loosen the default CSP "just to make Swagger work."** Open the CSP for Swagger's `/docs` route only — the API endpoints below it should keep the strict default.
- **Don't enable ngrok in any environment that doesn't write `development` to `APP_ENV`.** The check is `production` vs. everything else; misconfiguring `APP_ENV=staging` exposes your service publicly.
