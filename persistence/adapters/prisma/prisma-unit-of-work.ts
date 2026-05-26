import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { PrismaTransactionRepoFactory } from "./prisma-transaction-repo-factory";
import { randomUUID } from "crypto";
import { UnitOfWorkPort } from "../../context/unit-of-work";
import { TransactionContextStore } from "../../context/transaction-context.store";
import { TransactionContext } from "../../context/transaction.context";

@Injectable()
export class PrismaUnitOfWork implements UnitOfWorkPort {
	constructor(
		private readonly store: TransactionContextStore,
		private readonly prisma: PrismaService,
		private readonly repoFactory: PrismaTransactionRepoFactory,
	) {}

	isInTransaction(): boolean {
		return this.store.isInTransaction();
	}

	getCurrentTransaction(): TransactionContext | null {
		return this.store.getCurrentTransaction();
	}

	async withTransaction<T>(
		fn: (tx: TransactionContext) => Promise<T>,
	): Promise<T> {
		// If already in transaction: reuse it (nested UoW)
		const existing = this.store.getCurrentTransaction();
		if (existing) {
			return fn(existing);
		}

		// Else start a new transaction
		const txId = randomUUID();

		return this.prisma.instance.$transaction(async (txClient) => {
			const repos = this.repoFactory.createRepos(txClient as any);
			const txContext: TransactionContext = {
				metadata: {
					id: txId,
					orm: "prisma",
				},
				get: (token: symbol) => {
					const repo = (repos as any)[token];
					if (!repo) {
						throw new Error(`No transactional repo for token ${String(token)}`);
					}
					return repo;
				},
			};

			return this.store.runWithTransaction(txContext, () => fn(txContext));
		});
	}
}
