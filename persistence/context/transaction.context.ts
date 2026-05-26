import { OrmType } from "../persistence.config";

export interface TransactionMetadata {
	id: string; // uuid or similar
	orm: OrmType;
	// Could include DB name, replica/primary, etc.
	[key: string]: any;
}

/**
 * Context object passed to withTransaction callbacks.
 * It lets you access transactional repositories and metadata.
 */
export interface TransactionContext {
	readonly metadata: TransactionMetadata;

	/**
	 * Generic accessor to a repo bound to this transaction.
	 * You pass a DI token, you get the transactional implementation.
	 */
	get<T = any>(token: symbol): T;
}
