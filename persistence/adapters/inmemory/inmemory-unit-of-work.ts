import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { UnitOfWorkPort } from "../../context/unit-of-work";
import { TransactionContextStore } from "../../context/transaction-context.store";
import { TransactionContext } from "../../context/transaction.context";

@Injectable()
export class InMemoryUnitOfWork implements UnitOfWorkPort {
	constructor(private readonly store: TransactionContextStore) {}

	isInTransaction(): boolean {
		return this.store.isInTransaction();
	}

	getCurrentTransaction(): TransactionContext | null {
		return this.store.getCurrentTransaction();
	}

	async withTransaction<T>(
		fn: (tx: TransactionContext) => Promise<T>,
	): Promise<T> {
		const existing = this.store.getCurrentTransaction();
		if (existing) {
			return fn(existing);
		}
		const repos: Record<symbol, unknown> = {};
		const txContext: TransactionContext = {
			metadata: {
				id: randomUUID(),
				orm: "inmemory",
			},
			get: <T = any>(token: symbol): T => {
				const repo = repos[token];
				if (!repo) {
					throw new Error(`No transactional repo for token ${String(token)}`);
				}
				return repo as T;
			},
		};

		return this.store.runWithTransaction(txContext, () => fn(txContext));
	}
}
