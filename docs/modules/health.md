# `health`

```ts
import {
  HealthModule,
  HealthService,
  DbHealthIndicator,
  ORM_HEALTH_CLIENT, ORM_KIND, HEALTH_INDICATORS,
  type HealthModuleOptions,
  type HealthIndicator, type HealthIndicatorResult, type HealthIndicatorStatus,
  type HealthStatus, type OverallStatus,
} from "@alaska115/nextjs-toolkit/health";
```

Liveness and readiness endpoints with pluggable indicators, wired to
[`ShutdownManager`](./shutdown.md) so readiness fails the moment a drain starts.

## Setup

```ts
HealthModule.forRoot({
  enableDb: true,
  enableNotifications: false,
  orm: "prisma",
})
```

| Option                | Default | Effect                                                                 |
| --------------------- | ------- | ---------------------------------------------------------------------- |
| `enableDb`            | `true`  | Registers `DbHealthIndicator` (opt out with an explicit `false`).      |
| `enableNotifications` | `true`  | Imports [`NotificationModule`](./messaging.md) and includes its indicator. |
| `orm`                 | —       | `"prisma"` binds `PrismaHealthService` (needs `PrismaService` in the tree); anything else binds a stub that always pings `true`. |

> `enableNotifications` defaults to **on**, which pulls the whole notification
> module — nodemailer/Twig config included — into your app. Pass
> `enableNotifications: false` unless you actually send notifications.

`HealthModule.forRoot()` mounts `HealthHttpController` and exports
`HealthService`.

## Endpoints

Relative to your global prefix (`/api` by default):

| Route            | Backed by     | Semantics                                                   |
| ---------------- | ------------- | ----------------------------------------------------------- |
| `/health`        | `checkAll()`  | Runs every indicator.                                       |
| `/health/ready`  | `readiness()` | `down` immediately while draining, otherwise `checkAll()`.  |
| `/health/live`   | `liveness()`  | Always `{ status: "ok", details: {} }` — no external calls. |

On success, `200` with the payload:

```json
{
  "status": "ok",
  "details": {
    "db": { "status": "up", "info": { "latencyMs": 3 } }
  }
}
```

`status` is `"ok"` when every indicator is up, `"degraded"` when at least one is
down or threw, and `"down"` for the draining case.

**Anything other than `"ok"` is a `503`.** The controller throws
`ServiceUnavailableException` carrying the health payload, so orchestrators that
key on the status code — Kubernetes probes, load balancers, uptime monitors —
see the failure. The payload survives: with
[`HttpExceptionFilter`](./errors.md) registered it arrives as

```json
{ "status": 503, "code": "SERVICE_UNAVAILABLE", "message": "…",
  "details": { "status": "degraded", "details": { "db": { "status": "down" } } },
  "correlationId": "…" }
```

Point `livenessProbe` at `/health/live` and `readinessProbe` at `/health/ready`:
liveness must not depend on a database, or a brief DB outage gets your pods
restarted instead of merely removed from the load balancer.

## Custom indicators

```ts
@Injectable()
export class KafkaHealthIndicator implements HealthIndicator {
  name = "kafka";

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.admin.listTopics();
      return { name: this.name, status: "up" };
    } catch (e) {
      return { name: this.name, status: "down", info: { error: (e as Error).message } };
    }
  }
}
```

`HealthModule.forRoot()` builds the `HEALTH_INDICATORS` array from its own
options, so to add your own you register the multi-provider yourself in a module
of your own rather than passing it in. An indicator that throws is caught,
logged and reported as `down` with the error message — indicators never crash
the endpoint.
