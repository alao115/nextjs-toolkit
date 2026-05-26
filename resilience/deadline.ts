import { AsyncLocalStorage } from "node:async_hooks";
import { TimeoutError, withTimeout } from "./timeout";

interface DeadlineFrame {
	/** Absolute Unix epoch ms at which the deadline expires. */
	expiresAt: number;
}

const deadlineStorage = new AsyncLocalStorage<DeadlineFrame>();

/**
 * Runs `fn` under a deadline of `ms` from now. The deadline propagates through
 * async calls (anything using AsyncLocalStorage) so nested
 * {@link withDeadline} calls and {@link withRemainingBudget} can see it.
 *
 * If a parent deadline is active and the new `ms` would exceed it, the parent
 * deadline wins — nested calls can never get more budget than the caller had.
 */
export function withDeadline<T>(
	ms: number,
	fn: () => Promise<T>,
	op?: string,
): Promise<T> {
	const now = Date.now();
	const parent = deadlineStorage.getStore();
	const requested = now + ms;
	const expiresAt = parent ? Math.min(parent.expiresAt, requested) : requested;
	const effectiveMs = expiresAt - now;
	return deadlineStorage.run({ expiresAt }, () =>
		withTimeout(fn(), effectiveMs, op),
	);
}

/**
 * Returns the milliseconds remaining on the current deadline, or `undefined`
 * if no deadline is active. Use to short-circuit work that wouldn't fit in
 * the remaining budget.
 */
export function getRemainingBudget(): number | undefined {
	const frame = deadlineStorage.getStore();
	if (!frame) return undefined;
	return Math.max(0, frame.expiresAt - Date.now());
}

/**
 * Runs `fn` with a timeout = min(`ms`, remainingBudget). Useful for capping
 * an individual leaf call within a larger deadline budget.
 */
export function withRemainingBudget<T>(
	ms: number,
	fn: () => Promise<T>,
	op?: string,
): Promise<T> {
	const remaining = getRemainingBudget();
	const effective = remaining === undefined ? ms : Math.min(ms, remaining);
	if (effective <= 0) {
		return Promise.reject(new TimeoutError(0, op));
	}
	return withTimeout(fn(), effective, op);
}
