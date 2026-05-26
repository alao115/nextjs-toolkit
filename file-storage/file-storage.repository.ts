import { Inject, Injectable } from "@nestjs/common";
import {
	FindOptions,
	PERSISTENCE_ADAPTER,
	PersistencePort,
} from "../persistence";
import { FileEntity, IFileEntity } from "./file-storage.types";

@Injectable()
export class FileStorageRepository {
	constructor(
		@Inject(PERSISTENCE_ADAPTER)
		private readonly persistanceService: PersistencePort,
	) {}

	async findAll(options: Pick<FindOptions, "where">): Promise<FileEntity[]> {
		const files = await this.persistanceService.findMany<IFileEntity>({
			entity: "file",
			where: options.where,
		});

		return files.map((file) => new FileEntity(file));
	}

	async findOne(options: Pick<FindOptions, "where">): Promise<FileEntity> {
		const files = await this.findAll(options);
		return files.length > 0 ? files[0] : new FileEntity(null);
	}

	async findById(id: string): Promise<FileEntity> {
		const file = await this.persistanceService.findOne<IFileEntity>({
			where: { id },
			entity: "file",
		});

		return new FileEntity(file);
	}

	async create(file: Partial<IFileEntity>): Promise<FileEntity> {
		const createdFile = await this.persistanceService.insert<IFileEntity>({
			entity: "file",
			data: file,
		});

		return new FileEntity(createdFile);
	}

	async update(id: string, patch: Partial<IFileEntity>): Promise<FileEntity> {
		const updatedFile = await this.persistanceService.update<IFileEntity>({
			entity: "file",
			data: { id, ...patch },
		});

		return new FileEntity(updatedFile);
	}

	delete(id: string): Promise<void> {
		return this.persistanceService.delete({
			entity: "file",
			where: { id },
		});
	}
}
