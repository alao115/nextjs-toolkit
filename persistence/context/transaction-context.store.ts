import { AsyncLocalStorage } from "async_hooks";
import { Injectable } from "@nestjs/common";
import { TransactionContext } from "./transaction.context";

interface StoreState {
	transaction?: TransactionContext;
}

@Injectable()
export class TransactionContextStore {
	// TODO: replace with nestjs-cls
	private readonly als = new AsyncLocalStorage<StoreState>();

	runWithTransaction<T>(
		tx: TransactionContext,
		fn: () => Promise<T>,
	): Promise<T> {
		const current = this.als.getStore();
		const nextState: StoreState = {
			...(current || {}),
			transaction: tx,
		};
		return this.als.run(nextState, fn);
	}

	getCurrentTransaction(): TransactionContext | null {
		const store = this.als.getStore();
		return store?.transaction ?? null;
	}

	isInTransaction(): boolean {
		return this.getCurrentTransaction() != null;
	}
}
