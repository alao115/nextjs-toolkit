# `shutdown`

```ts
import {
  ShutdownModule,
  ShutdownManager,
  type ShutdownHook,
  type PrioritizedShutdownHook,
  type ShutdownPhase,
} from "@alaska115/nextjs-toolkit/shutdown";
```

One ordered, phased shutdown sequence for the whole process. Several toolkit
modules register hooks here automatically — Prisma, the Winston adapter, the
OTel SDK, the outbox worker, and `registerShutdownAppHook`.

## Setup

```ts
@Module({ imports: [ShutdownModule] })  // @Global(); provides ShutdownManager
export class AppModule {}
```

`ShutdownManager.onModuleInit()` binds `SIGTERM` and `SIGINT` itself, so you do
**not** need `app.enableShutdownHooks()` for these hooks to fire.

## Registering a hook

```ts
@Injectable()
export class KafkaConsumer implements OnModuleInit {
  constructor(private readonly shutdown: ShutdownManager) {}

  onModuleInit() {
    this.shutdown.registerHook({
      name: "kafka-consumer",
      phase: "preStopTraffic",
      order: 10,
      shutdown: async () => { await this.consumer.disconnect(); },
    });
  }
}
```

## Phases

Hooks run phase by phase; within a phase, ascending `order`.

| Phase             | Use it for                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| `preStopTraffic`  | Flip readiness to down, stop pulling new work (consumers, pollers, cron). |
| `stopTraffic`     | Close the HTTP server / drain in-flight requests (`app.close()`).        |
| `infra`           | Disconnect databases, Redis, message brokers.                            |
| `logging`         | Flush logs, traces, metrics — last, so earlier phases are still observable. |

That ordering is what makes a Kubernetes rollout graceful: readiness fails first
so the load balancer stops sending traffic, then in-flight requests finish, then
connections close, then telemetry flushes.

## `ShutdownManager` API

| Member                      | Behaviour                                                       |
| --------------------------- | ---------------------------------------------------------------- |
| `registerHook(hook)`        | Adds a hook. `phase` defaults to `"infra"`, `order` to `100`.    |
| `shutdown(): Promise<void>` | Runs every hook, phase by phase, ascending `order`.             |
| `isShuttingDown(): boolean` | Read by [`HealthService.readiness()`](./health.md) to fail readiness during drain. |

On `SIGTERM` / `SIGINT` the manager sets the shutting-down flag, runs
`shutdown()`, then calls `process.exit(0)` (or `1` if the sequence itself
threw). A second signal during a drain is logged and ignored.

> Calling `shutdown()` directly does **not** set `isShuttingDown()` — only the
> signal handler does. In tests, drive it through a signal if you're asserting
> on readiness.

Hook failures are logged and do not abort the remaining hooks — one broken
disconnect can't strand the rest of the sequence.

## Kubernetes checklist

1. `preStopTraffic` hook (or `isShuttingDown()`) makes `/health/ready` fail.
2. `terminationGracePeriodSeconds` is longer than your slowest in-flight request.
3. `registerShutdownAppHook(app)` is called in `main.ts` so the HTTP server
   actually closes.

See [`examples/11-graceful-shutdown.ts`](../../examples/11-graceful-shutdown.ts).
