import { TransactionContext } from "./transaction.context";

export interface UnitOfWorkPort {
	/**
	 * Run the callback in a transaction.
	 * If a transaction already exists in the current context, it SHOULD join / reuse it.
	 */
	withTransaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

	/**
	 * Returns true if the current execution context is inside a transaction.
	 */
	isInTransaction(): boolean;

	/**
	 * Returns the current transaction context if any, otherwise null.
	 */
	getCurrentTransaction(): TransactionContext | null;
}

// export const UNIT_OF_WORK = Symbol("UNIT_OF_WORK");
