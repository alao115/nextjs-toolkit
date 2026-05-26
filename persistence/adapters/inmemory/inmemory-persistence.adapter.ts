import { Injectable } from "@nestjs/common";
import { FindOptions, PersistencePort } from "../../persistence.service";

const NOT_IMPLEMENTED =
	"InMemoryPersistenceAdapter has no engine wired. Subclass it and override the relevant methods, or pick the 'prisma' orm in PersistenceModule.register().";

@Injectable()
export class InMemoryPersistenceAdapter implements PersistencePort {
	get getOrm(): never {
		throw new Error(NOT_IMPLEMENTED);
	}

	async findOne<T>(_options: FindOptions): Promise<T | null> {
		throw new Error(NOT_IMPLEMENTED);
	}

	async findMany<T>(_options: FindOptions): Promise<T[]> {
		throw new Error(NOT_IMPLEMENTED);
	}

	async insert<T>(_payload: { entity: string; data: any }): Promise<T> {
		throw new Error(NOT_IMPLEMENTED);
	}

	async update<T>(_payload: { entity: string; data: any }): Promise<T> {
		throw new Error(NOT_IMPLEMENTED);
	}

	async delete(_payload: {
		entity: string;
		where: Record<string, any>;
	}): Promise<void> {
		throw new Error(NOT_IMPLEMENTED);
	}

	async transactional<T>(_fn: (ctx?: any) => Promise<T>): Promise<T> {
		throw new Error(NOT_IMPLEMENTED);
	}
}
