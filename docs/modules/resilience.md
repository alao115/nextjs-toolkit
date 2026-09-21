# `resilience`

> **Experimental** — the API may change before 1.0.

```ts
import {
  withTimeout, TimeoutError,
  retry,
  CircuitBreaker, CircuitOpenError,
  RedisCircuitBreaker,
  Bulkhead, BulkheadFullError,
  withDeadline, withRemainingBudget, getRemainingBudget,
  type RetryOptions, type CircuitBreakerOptions, type CircuitState,
  type RedisCircuitBreakerOptions, type BulkheadOptions,
} from "@alaska115/nextjs-toolkit/resilience";
```

Plain functions and classes — no Nest module, no DI. Wrap any call that crosses
a process boundary.

## `withTimeout`

```ts
const rates = await withTimeout(fx.getRates(), 2_000, "fx.getRates");
```

Rejects with `TimeoutError` after `ms`. Note that the underlying promise is not
cancelled — it keeps running; you just stop waiting.

## `retry`

```ts
const result = await retry(() => http.post(url, body), {
  maxRetries: 3,
  baseBackoffMs: 200,
  maxBackoffMs: 5_000,
  jitterMs: 100,
  shouldRetry: (err) => (err as any)?.status >= 500,
  onError: (err, attempt) => logger.warn("retrying", { attempt, err }),
});
```

Defaults: `maxRetries: 3`, `baseBackoffMs: 200`, `maxBackoffMs: 4000`,
`jitterMs: 100`. `maxRetries: 3` means up to **four** calls — the first attempt
plus three retries. The last error is rethrown when the budget runs out or
`shouldRetry` returns `false`.

Backoff is `min(maxBackoffMs, baseBackoffMs * 2^attempt) + random(jitterMs)`,
**unless the error carries a server hint**, in which case that wins (still
capped by `maxBackoffMs`). Recognized hints:

- `err.retryAfterMs` (number)
- `err.headers["retry-after"]` — seconds or an HTTP-date
- `err.response.headers["retry-after"]` — same

So a 429 from a well-behaved API is honoured automatically.

`shouldRetry` decides per error — retrying a 400 just wastes the caller's time;
retry 5xx, timeouts and connection resets. Only retry operations that are safe
to repeat, or make them idempotent first. `onError(err, attempt)` fires before
each sleep, which is where telemetry belongs.

## `CircuitBreaker`

```ts
const breaker = new CircuitBreaker("payments", {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
});

await breaker.run(() => payments.charge(order));   // throws CircuitOpenError when open
breaker.getState();                                 // "closed" | "open" | "half-open"
```

Defaults: `failureThreshold: 5`, `resetTimeoutMs: 30_000`,
`halfOpenSuccessThreshold: 2`.

States: `closed` → `open` after `failureThreshold` consecutive failures;
`open` → `half-open` after `resetTimeoutMs`; `half-open` → `closed` after
`halfOpenSuccessThreshold` successes, back to `open` on one failure.

State is **per instance, per process**. Create one breaker per dependency and
hold it — a breaker created per request never opens.

## `RedisCircuitBreaker`

```ts
const breaker = new RedisCircuitBreaker({
  client: redis,
  name: "payments",
  failureThreshold: 20,
  resetTimeoutMs: 30_000,
  keyPrefix: "cb",
});

await breaker.run(() => payments.charge(order));
await breaker.getState();   // async — reads Redis
```

Same semantics, shared across every instance via Lua scripts. Use this when you
want the whole fleet to back off together; scale `failureThreshold` for the
aggregate request rate, not a single pod's.

## `Bulkhead`

```ts
const pool = new Bulkhead("reports", { maxConcurrent: 5, maxQueueSize: 20 });

await pool.run(() => generateReport(id));   // throws BulkheadFullError when the queue is full
pool.getInFlight();
pool.getQueueLength();
```

Caps concurrency for one dependency so a slow downstream can't consume the whole
event loop. Rejecting fast when the queue is full is the point — an unbounded
queue converts a throughput problem into a memory problem.

## Deadlines

```ts
await withDeadline(5_000, async () => {
  await stepOne();
  await withRemainingBudget(3_000, () => stepTwo());   // min(3000, what's left)
  const left = getRemainingBudget();                    // ms, or undefined
  if (left !== undefined && left < 200) return partialResult();
  return stepThree();
}, "checkout");
```

The deadline lives in `AsyncLocalStorage`, so it propagates through nested async
calls without threading a parameter. A nested `withDeadline` can only ever
**shorten** the budget — `Math.min(parent, requested)` — so a sub-call can't
outlive its caller's deadline.

`withRemainingBudget` rejects immediately with `TimeoutError` when the budget is
already exhausted.

## Composing

Order matters. The usual stack, outermost first:

```ts
await withDeadline(5_000, () =>
  breaker.run(() =>
    pool.run(() =>
      retry(() => withTimeout(client.call(), 1_000, "client.call"), { maxRetries: 2 }),
    ),
  ),
);
```

Deadline caps the whole operation, the breaker skips a dependency that is
already down, the bulkhead caps concurrency, retry handles blips, and the
innermost timeout bounds one attempt. Putting retry outside the timeout would
retry an operation you never bounded.

See [`examples/06-resilience.ts`](../../examples/06-resilience.ts).
