# `@alaska115/nextjs-toolkit/resilience`

Composable resilience primitives. Use these to wrap **every call out of your process**: HTTP, RPC, DB, queue, cache, file store. Without them a single misbehaving dependency can drag your service down.

## What's in the box

| Primitive       | Pattern                | When to reach for it |
| --------------- | ---------------------- | --- |
| `withTimeout`   | Time-bound a call      | Every remote call. No exceptions. |
| `withDeadline`  | Propagate a budget via ALS | When a request fans out to multiple dependencies and the total time matters more than any single hop. |
| `retry`         | Exponential backoff + jitter, honors `Retry-After` | Transient failures (network, 502/503, deadlock). Not for 4xx. |
| `CircuitBreaker`| Stop hammering a sick dependency | Repeated failures from the same dep — open the breaker, fail-fast, periodically probe. |
| `Bulkhead`      | Cap concurrency per dep | One slow dep shouldn't starve your event loop of workers. |

## Recipes

### A single remote call

```ts
import { withTimeout, retry } from "@alaska115/nextjs-toolkit/resilience";

const result = await retry(
	() => withTimeout(http.get("/users"), 2000, "users.get"),
	{ maxRetries: 3, baseBackoffMs: 200, maxBackoffMs: 2000, jitterMs: 100 },
);
```

`retry` reads `Retry-After` from any thrown error that has it (HTTP headers `.headers["retry-after"]` or `.response.headers["retry-after"]`, or a `.retryAfterMs` field) and uses that as the next delay — overriding exponential backoff. So if a downstream sends `Retry-After: 5`, you sleep 5s.

### A request with a hard budget

```ts
import { withDeadline, withRemainingBudget } from "@alaska115/nextjs-toolkit/resilience";

await withDeadline(500, async () => {
	const user = await withRemainingBudget(200, () => userSvc.get(id));
	const prefs = await withRemainingBudget(200, () => prefsSvc.get(user.id));
	return { user, prefs };
});
```

The total wall-clock is capped at 500ms; each leaf call is also capped at 200ms **but never more than what's left of the parent deadline**. Nested `withDeadline` calls inherit (`min(parent, requested)`).

### A breaker + bulkhead around a single dependency

```ts
const searchBreaker = new CircuitBreaker("search", { failureThreshold: 5, resetTimeoutMs: 30_000 });
const searchBulkhead = new Bulkhead("search", { maxConcurrent: 20, maxQueueSize: 50 });

async function search(q: string) {
	return searchBreaker.run(() =>
		searchBulkhead.run(() => withTimeout(searchClient.query(q), 1500, "search")),
	);
}
```

Combine: bulkhead first (so failing-open breaker requests don't pile up in the queue), then breaker, then timeout — but order is somewhat tasteful.

## Anti-patterns

- **Don't `retry` on 4xx.** Validate `shouldRetry` against the error: only retry network errors, 5xx, and `Retry-After` responses.
- **Don't share a `CircuitBreaker` across unrelated dependencies.** One instance per downstream. A breaker for "the API" means a slow search backend opens the breaker for healthy auth calls too.
- **Distributed breakers**: the in-package `CircuitBreaker` is per-instance. For fleet-wide coordination, mirror its state through Redis (publish open/close events).
