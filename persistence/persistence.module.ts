import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { PERSISTENCE_ADAPTER, UNIT_OF_WORK } from "./persistence.constants";
import { AppPersistenceConfig, PRISMA_CLIENT, PRISMA_OPTIONS } from "./persistence.config";
import {
	PrismaPersistenceAdapter,
	PrismaService,
	PrismaTransactionRepoFactory,
	PrismaUnitOfWork,
} from "./adapters/prisma";

import {
	InMemoryPersistenceAdapter,
	InMemoryUnitOfWork,
} from "./adapters/inmemory";
import { TransactionContextStore } from "./context/transaction-context.store";

@Global()
@Module({})
export class PersistenceModule {
	static register(config: AppPersistenceConfig): DynamicModule {
		const providers: Provider[] = [TransactionContextStore];
		const exports: any[] = [];

		let persistenceProvider: Provider;
		let unitOfWorkProvider: { provide: typeof UNIT_OF_WORK; useClass: any };

		switch (config.orm) {
			case "prisma":
				providers.push(
					PrismaService,
					PrismaTransactionRepoFactory,
					PrismaUnitOfWork,
					PrismaPersistenceAdapter,
					{ provide: PRISMA_OPTIONS, useValue: config },
					{ provide: PRISMA_CLIENT, useValue: config.ormClient },
				);

				unitOfWorkProvider = {
					provide: UNIT_OF_WORK,
					useClass: PrismaUnitOfWork,
				};

				persistenceProvider = {
					provide: PERSISTENCE_ADAPTER,
					useClass: PrismaPersistenceAdapter,
				};

				exports.push(PrismaService);
				break;

			case "inmemory":
			default:
				providers.push(InMemoryUnitOfWork, InMemoryPersistenceAdapter);

				unitOfWorkProvider = {
					provide: UNIT_OF_WORK,
					useClass: InMemoryUnitOfWork,
				};

				persistenceProvider = {
					provide: PERSISTENCE_ADAPTER,
					useClass: InMemoryPersistenceAdapter,
				};
				break;
		}

		providers.push(unitOfWorkProvider, persistenceProvider);

		return {
			module: PersistenceModule,
			providers,
			exports: [unitOfWorkProvider, persistenceProvider, ...exports],
		};
	}
}
