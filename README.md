# @alaska115/nextjs-toolkit

A reusable backend toolkit for **NestJS + Express** services. Ships ready-to-use building blocks for:

| Module             | What it provides                                                                  |
| ------------------ | --------------------------------------------------------------------------------- |
| `bootstrap`        | CORS, Helmet, CSP, sessions, Swagger, ngrok proxy, graceful shutdown registration |
| `cache`            | Redis-backed cache integration                                                    |
| `config`           | Joi-validated config loaders                                                      |
| `context`          | Async request context (interceptor + service)                                     |
| `errors`           | Typed error classes and HTTP error mapping                                        |
| `file-storage`     | S3 / MinIO file storage abstraction                                               |
| `health`           | Liveness / readiness endpoints                                                    |
| `messaging`        | Notifications (mail via nodemailer, templating via Twig)                          |
| `observability`    | OpenTelemetry tracing + Prometheus metrics + Sentry + Winston logging             |
| `persistence`      | Prisma client wiring (pg adapter)                                                 |
| `secret`           | Pluggable secret manager interface (with local implementation)                    |
| `security`         | Argon2 hashing helpers, security middleware                                       |
| `shutdown`         | Graceful shutdown hooks                                                           |
| `utils`            | Date (luxon), case conversion, UUID, fetch                                        |

---

## Install

```bash
npm install @alaska115/nextjs-toolkit
# or
pnpm add @alaska115/nextjs-toolkit
# or
yarn add @alaska115/nextjs-toolkit
```

Then install the **peer dependencies** so the consumer controls the NestJS / Express version:

```bash
npm install \
  @nestjs/common@^10 \
  @nestjs/core@^10 \
  @nestjs/platform-express@^10 \
  @nestjs/config@^4 \
  @nestjs/cache-manager@^3 \
  @nestjs/swagger@^11 \
  express@^4
```

---

## Usage

```ts
// Root re-exports
import { AppError, RequestContextService } from "@alaska115/nextjs-toolkit";

// Subpath imports (preferred — better tree-shaking and clearer intent)
import { bootstrap } from "@alaska115/nextjs-toolkit/bootstrap";
import { CacheModule } from "@alaska115/nextjs-toolkit/cache";
import { loadConfig } from "@alaska115/nextjs-toolkit/config";
import { RequestContextService } from "@alaska115/nextjs-toolkit/context";
import { AppError } from "@alaska115/nextjs-toolkit/errors";
import { FileStorageModule } from "@alaska115/nextjs-toolkit/file-storage";
import { HealthModule } from "@alaska115/nextjs-toolkit/health";
import { NotificationService } from "@alaska115/nextjs-toolkit/messaging";
import { Observability } from "@alaska115/nextjs-toolkit/observability";
import { PrismaService } from "@alaska115/nextjs-toolkit/persistence";
import { SecretManager } from "@alaska115/nextjs-toolkit/secret";
import { SecurityModule } from "@alaska115/nextjs-toolkit/security";
import { gracefulShutdown } from "@alaska115/nextjs-toolkit/shutdown";
import { ... } from "@alaska115/nextjs-toolkit/utils";
```

---

## Publishing

The package is a **standalone npm module**. Build artifacts in `dist/` are what gets published — source `.ts` files are intentionally excluded via the `files` field.

### One-time setup

1. **Own the scope.** `@alaska115` must be a scope you control on the registry you publish to. If it isn't, change `name` in `package.json` to one you own.
2. **Authenticate** to your registry:
   - **Public npmjs.org:** `npm login`
   - **Private registry / GitHub Packages / GitLab / Verdaccio:** add a `.npmrc` with the appropriate `registry=` and `_authToken=` entries.

### Release

```bash
cd packages/core
npm version <patch|minor|major>   # bumps version, creates a git tag
npm publish                       # prepublishOnly will clean + build first
git push --follow-tags
```

- `publishConfig.access` is set to `public`, so a scoped package will be published publicly by default. Change to `restricted` (or remove the field) for a paid private package on npmjs.org.

### Publishing to a different registry

Add `publishConfig.registry` in `package.json` (or pass `--registry` on the CLI):

```json
"publishConfig": {
  "access": "restricted",
  "registry": "https://npm.pkg.github.com"
}
```

Common targets:

| Registry                    | URL                                                           |
| --------------------------- | ------------------------------------------------------------- |
| npmjs.org (public)          | `https://registry.npmjs.org`                                  |
| GitHub Packages             | `https://npm.pkg.github.com`                                  |
| GitLab Package Registry     | `https://gitlab.com/api/v4/projects/<PROJECT_ID>/packages/npm/` |
| Self-hosted Verdaccio       | `https://your-verdaccio.example.com`                          |

---

## Local development

```bash
npm install
npm run build         # one-shot compile to dist/
npm run start:dev     # tsc --watch
npm run clean         # remove dist/
```

To consume the package locally from another project without publishing, use `npm link`, a workspace, or [yalc](https://github.com/wclr/yalc):

```bash
# from packages/core
npm pack                              # produces alaska115-nextjs-toolkit-0.4.0.tgz
# from the consumer project
npm install /absolute/path/to/alaska115-nextjs-toolkit-0.4.0.tgz
```

---

## License

MIT
