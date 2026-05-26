# `@alaska115/nextjs-toolkit/health`

Pluggable health indicators with liveness/readiness split. Ships a DB indicator (Prisma) and a notification-provider indicator out of the box.

## Wire it up

```ts
import { HealthModule } from "@alaska115/nextjs-toolkit/health";

@Module({
  imports: [
    HealthModule.forRoot({
      enableDb: true,
      enableNotifications: true,
      orm: "prisma",       // or "inmemory" for tests
    }),
  ],
})
export class AppModule {}
```

The module mounts a controller at `/health` (or `${http.globalPrefix}/health` if you have a global prefix) with three endpoints:

| Endpoint        | Use                                                                |
| --------------- | ------------------------------------------------------------------ |
| `GET /liveness` | Cheap, no external deps. "Is the process still alive?"             |
| `GET /readiness`| Runs every indicator. Returns 503 while `ShutdownManager.isShuttingDown()` is true so the load balancer drains traffic. |
| `GET /`         | Same as `/readiness` — convenience alias for tools that don't split. |

## Response shape

```json
{
  "status": "ok",                          // "ok" | "degraded" | "down"
  "details": {
    "db": { "status": "up", "info": { "orm": "prisma", "latencyMs": 4 } },
    "notification": { "status": "up", "info": { /* per-provider */ } }
  }
}
```

`status` is `degraded` if any indicator is `down` (still 200, alert-only). Use the per-indicator `details` for routing: a degraded DB means "still answering reads, don't send new writes."

## Add your own indicator

```ts
import { HealthIndicator, HealthIndicatorResult } from "@alaska115/nextjs-toolkit/health";

@Injectable()
export class KafkaHealthIndicator implements HealthIndicator {
  name = "kafka" as const;

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.kafka.metadata();
      return { name: this.name, status: "up" };
    } catch (err) {
      return { name: this.name, status: "down", info: { error: (err as Error).message } };
    }
  }
}
```

Register in your module's providers; the `HEALTH_INDICATORS` provider auto-collects everything injected with `HealthIndicator`.

## Anti-patterns

- **Don't make `liveness` hit external dependencies.** Kubernetes restarts the pod when liveness fails — you don't want a slow Redis to cause a rolling restart of every replica.
- **Don't put long-running checks (>2s) in any indicator.** The endpoint blocks until all indicators return. Probes timeout at 1–5s in most orchestrators.
- **Don't return `503` for `degraded`.** Degraded means "serve cautiously" — only `down` should be 5xx. The current implementation always returns 200; only `isShuttingDown()` flips to 503.
