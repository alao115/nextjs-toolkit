# `messaging`

```ts
import {
  NotificationModule,
  NotificationService,
  NotificationHealthIndicator,
  NOTIFICATION_PROVIDERS, NOTIFICATION_IDEMPOTENCY_STORE,
  MAIL_PROVIDER, SMS_PROVIDER, WHATSAPP_PROVIDER, TEMPLATE_ENGINE,
  type NotificationMessage, type NotificationResult, type NotificationProvider,
  type NotificationChannel, type NotificationContext, type NotificationPayload,
  type NotificationRetryPolicy, type TemplateDefinition, type TemplateEngineOptions,
  type INotificationTemplateEngine, type IdempotencyStore, type ProviderHealth,
} from "@alaska115/nextjs-toolkit/messaging";
```

Channel-agnostic notifications: render a template, pick a provider for the
channel, send with retries and idempotency, record metrics and a span.

## Setup

```ts
@Module({ imports: [NotificationModule] })
export class AppModule {}
```

`NotificationModule` builds everything from `ConfigService` — no options object:

| Config key            | Effect                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `mail.templateEngine` | `"twig"` → `TwigNotificationTemplateEngine` (needs the optional `twig` peer dep); anything else → `DefaultNotificationTemplateEngine`. |
| `mail.templatesDir`   | Directory the engine loads templates from (`NOTIFICATION_TEMPLATES_DIR`). |
| `mail.provider`       | `"bomboo"` → `BombooMailNotificationAdapter`; anything else → `NodemailerEmailAdapter`. |
| `mail.sender`         | Default `from` address (falls back to `no-reply@example.com`).        |
| `mail.host/port/user/password/secure` | Nodemailer transport settings.                        |

It registers **one** provider — `EmailProvider`, backed by the mail transport
selected above — plus an in-memory idempotency store.

SMS and WhatsApp have **no** provider out of the box. `send({ channel: "sms" })`
therefore throws `No notification provider registered for channel: sms`, which
is deliberate: up to 0.7.0 those channels were wired to clients that only
`console.log`'d and returned a fake id, so sends resolved with `success: true`
and silently delivered nothing.

To enable them, override `NOTIFICATION_PROVIDERS` with your own array — see
[Custom providers](#custom-providers). (The `SMS_PROVIDER` and
`WHATSAPP_PROVIDER` symbols are exported but not bound by `NotificationModule`,
so overriding those has no effect.) `SmsProvider` and `WhatsAppProvider` still
ship, so wiring a real `SmsClient` / `WhatsAppClient` into them is a two-line
change.

> Replace `NOTIFICATION_IDEMPOTENCY_STORE` with a Redis-backed
> `IdempotencyStore` before running more than one instance — the default store
> is a per-process `Map`.

## Sending

```ts
const result = await this.notifications.send(
  {
    to: "user@example.com",
    channel: "email",
    templateKey: "welcome",
    context: { firstName: "Ada" },
    subject: "Welcome",              // optional; template can supply it
    idempotencyKey: `welcome:${userId}`,
    correlationId: ctx.correlationId,
  },
  { maxRetries: 3, baseBackoffMs: 200, maxBackoffMs: 5_000, jitterMs: 100 },
);

if (!result.success) {
  logger.warn("notification failed", { code: result.errorCode, provider: result.provider });
}
```

`send()` returns a `NotificationResult` (`success`, `provider`, `messageId?`,
`errorCode?`, `errorMessage?`). Provider failures are **not** thrown — they come
back as `success: false` (`errorCode: "PROVIDER_EXCEPTION"` when the provider
threw), so callers decide whether a failed notification is fatal.

It *does* throw for programmer errors: no provider supports the channel, or the
`templateKey` is unknown (`NotificationTemplateNotFoundError`).

Behaviour:

1. If `idempotencyKey` was already seen, the stored result is returned without
   sending again.
2. The template engine renders `{ subject, body }` from `templateKey` + `context`.
3. The first provider whose `supports(channel)` is true handles the send.
4. Failures retry with exponential backoff and jitter per the retry policy.
5. `notifications_send_total` and `notifications_send_duration_seconds` are
   recorded inside a `notification.send` span.

Default retry policy: `{ maxRetries: 3, baseBackoffMs: 500, maxBackoffMs: 4000,
jitterMs: 250 }`. The object you pass is merged over it.

> `NotificationService` registers its two metrics on `prom-client`'s **default**
> registry, while [`PrometheusMetricsAdapter`](./observability.md) exports its
> own. Those two metrics therefore do not show up at `/metrics`; scrape
> `client.register.metrics()` separately if you need them.
>
> `prom-client` and `@opentelemetry/api` are loaded lazily and are genuinely
> optional: without them the metrics become no-ops and the send still runs
> inside a `TracingService` span, it just cannot propagate ambient OTel context.

## Templates

`TemplateDefinition` is `{ key, channel, subject?, body }`. Both engines accept
`{ templatesDir?, preload?: TemplateDefinition[] }`.

- `DefaultNotificationTemplateEngine` — simple `{{ placeholder }}` substitution
  in body and subject.
- `TwigNotificationTemplateEngine` — full Twig, for loops/conditionals/partials.

An unknown key raises `NotificationTemplateNotFoundError` (a
[`BaseException`](./errors.md) subclass).

## Health

`NotificationHealthIndicator` (name `"notification"`) calls `checkHealth()` on
every provider that implements it, with a timeout, and reports `ProviderHealth`
per provider. For email that means `transporter.verify()` — an SMTP
connectivity and auth check that sends nothing.

> Before 0.8.0 the nodemailer adapter's `checkHealth()` was nodemailer's
> Ethereal sample code: it created a throwaway test account over the network and
> sent a hardcoded message on **every call**, never touching the configured
> transport. Combined with `enableNotifications` defaulting to on, a Kubernetes
> readiness probe sent a dummy email every few seconds and reported "up"
> regardless of whether your SMTP server was reachable. It is provided *and exported* by `NotificationModule`; a
`HealthModule.forRoot({ enableNotifications: true })` picks it up — do not
re-provide it, or Nest will try to resolve its dependencies in the wrong
injector.

## Custom providers

```ts
class TwilioSmsProvider implements NotificationProvider {
  readonly name = "sms.twilio";
  supports(channel: NotificationChannel) { return channel === "sms"; }
  async send(message, rendered): Promise<NotificationResult> { /* ... */ }
  async checkHealth() { return true; }
}

{ provide: NOTIFICATION_PROVIDERS, useValue: [new TwilioSmsProvider(), emailProvider] }
```

Order matters — the first provider that supports the channel wins.
