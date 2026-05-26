import {
	TransactionContext,
	TransactionMetadata,
} from "../../context/transaction.context";
import { PrismaTransactionalTokenMap } from "./prisma-transaction-repo-factory";

export class PrismaTransactionContext implements TransactionContext {
	constructor(
		public readonly metadata: TransactionMetadata,
		private readonly repos: PrismaTransactionalTokenMap,
	) {}

	get<T = any>(token: symbol): T {
		const repo = (this.repos as any)[token];
		if (!repo) {
			throw new Error(`No transactional repo found for token ${String(token)}`);
		}
		return repo as T;
	}
}
