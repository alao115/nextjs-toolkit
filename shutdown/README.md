# `@alaska115/nextjs-toolkit/shutdown`

Phased graceful shutdown. Binds to `SIGTERM` / `SIGINT`, runs registered hooks in order, then exits cleanly. Used by every other module — the package's "one place where the process ends."

## Wire it up

```ts
import { ShutdownModule } from "@alaska115/nextjs-toolkit/shutdown";

@Module({ imports: [ShutdownModule] })
export class AppModule {}
```

`ShutdownModule` is `@Global()`. **Don't** also register `ShutdownManager` in your own module — duplicate registration creates two instances and only one binds to signals. See [ADR 0001](../docs/adr/0001-port-adapter-everywhere.md) for the canonicalization story.

## Phases

Hooks run in this fixed order:

| Phase             | Use for                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `preStopTraffic`  | Flip readiness probe to `down` so the load balancer drains traffic. |
| `stopTraffic`     | Close the HTTP server (`app.close()`), stop accepting new requests.  |
| `infra`           | Drain queues, flush outbox, close DB / Redis pools.                  |
| `logging`         | Final logger flush, span exporter flush, metrics scrape.             |

Within a phase, hooks run in ascending `order` (default `100`), one at a time. A throwing hook is logged and **does not stop** subsequent hooks — graceful shutdown is best-effort.

## Register a hook

```ts
constructor(private readonly shutdown: ShutdownManager) {}

onModuleInit() {
  this.shutdown.registerHook({
    name: "kafka-producer",
    phase: "infra",
    order: 20,
    shutdown: async () => {
      await this.kafkaProducer.flush();
      await this.kafkaProducer.disconnect();
    },
  });
}
```

Built-in hooks the package registers for you:

- `prisma-client` (`infra`, order 10) — `PrismaService.onModuleInit`
- `outbox-worker` (`infra`, order 20) — `OutboxWorker.onModuleInit`
- `otel-tracer` (`logging`, order 10) — `OtelTracingAdapter.onModuleInit`

## Readiness coordination

```ts
@Get("readiness")
readiness() {
  if (this.shutdown.isShuttingDown()) {
    return { status: "down" }; // 503 → LB drains
  }
  return this.health.checkAll();
}
```

`HealthService.readiness()` already does this — no need to duplicate.

## Anti-patterns

- **Don't `process.exit()` from a hook.** The manager handles the exit code. A hook calling `process.exit` skips every later hook (data loss).
- **Don't put `await new Promise(resolve => setTimeout(resolve, X))` in a hook to "give things time to settle."** Tear down the *thing* that needs settling, not the wall clock.
- **Don't bind to SIGKILL.** Node can't catch it; the kernel kills the process. Make sure your in-progress writes are durable BEFORE crash, not on the way out.
- **Don't put DB writes in `logging` phase hooks.** The DB pool is closed by then.
