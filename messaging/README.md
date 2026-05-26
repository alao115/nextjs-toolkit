# `@alaska115/nextjs-toolkit/messaging`

Multi-channel notifications (email, SMS, WhatsApp) with template rendering, retry policy, and an idempotency store. Pluggable mail providers (`NodemailerEmailAdapter`, `BombooMailNotificationAdapter`) and template engines (`TwigNotificationTemplateEngine`, `DefaultNotificationTemplateEngine`).

## Wire it up

```ts
import { NotificationModule } from "@alaska115/nextjs-toolkit/messaging";

@Module({ imports: [NotificationModule] })
export class AppModule {}
```

`NotificationModule` is **not** `@Global()` — import it in every module that uses `NotificationService` (or re-export it from a shared module). This is deliberate; see [ADR 0001](../../docs/adr/0001-port-adapter-everywhere.md).

Adapter selection: `mail.provider` config picks between `bomboo` and `nodemailer`. Template engine: `mail.templateEngine` picks `twig` or `default`. SMS/WhatsApp providers ship as `dummy*Client` stubs that log to the console — replace them in your own module.

## Send a notification

```ts
constructor(private readonly notify: NotificationService) {}

async sendWelcomeEmail(user: User) {
  await this.notify.send({
    channel: "email",
    to: user.email,
    templateKey: "welcome-email",
    context: { userName: user.name },
    subject: "Welcome",
    idempotencyKey: `welcome:${user.id}`,   // optional but recommended
  });
}
```

## Retry policy + idempotency

`NotificationService.send()` retries non-success results with exponential backoff (default: 3 retries, 500–4000 ms backoff, 250 ms jitter). Pass `{ maxRetries, baseBackoffMs, maxBackoffMs, jitterMs }` as a second arg to override.

`idempotencyKey` is checked against the configured `IdempotencyStore` before the first send. The default store is `InMemoryIdempotencyStore` — fine for single-process dev, **insufficient for production** (state is lost on restart, not shared across replicas). Swap in a Redis-backed store via the `NOTIFICATION_IDEMPOTENCY_STORE` symbol.

## Templates

Templates live under `${NOTIFICATION_TEMPLATES_DIR}` and are rendered by the configured engine. Twig is recommended for HTML emails; the default engine is a no-op for services that pre-render bodies upstream.

## Health

`NotificationHealthIndicator` is registered when `enableNotifications` is true on `HealthModule.forRoot()`. It calls `checkHealth()` on each provider; failures surface in `/readiness`.

## Anti-patterns

- **Don't send notifications inside business transactions.** If the email gateway is slow, your DB locks pile up. Use the [outbox pattern](../../outbox/README.md) — write a `notification.send` event in the transaction, drain it from a worker.
- **Don't use `InMemoryIdempotencyStore` in production.** Two replicas don't share state; a restart loses the dedup window.
- **Don't put PII in `templateKey`.** Template keys go into logs, metrics labels, and traces.
