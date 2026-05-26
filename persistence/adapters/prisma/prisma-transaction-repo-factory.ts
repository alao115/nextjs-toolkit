import { Injectable } from "@nestjs/common";

/**
 * Maps a DI token to the transactional repository instance bound to a
 * specific Prisma transaction client. Consumers subclass
 * {@link PrismaTransactionRepoFactory} to provide their own mappings.
 */
export type PrismaTransactionalTokenMap = Record<symbol, unknown>;

/**
 * Extension point for binding repositories to a Prisma transaction client.
 * The default implementation returns an empty map — usable when the consumer
 * does not need per-transaction repository instances.
 */
@Injectable()
export class PrismaTransactionRepoFactory {
	createRepos(_txClient: any): PrismaTransactionalTokenMap {
		return {};
	}
}
