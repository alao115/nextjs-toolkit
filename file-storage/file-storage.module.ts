import { Module } from "@nestjs/common";
import { FileStorageController } from "./file-storage.controller";
import { FileStorageService } from "./file-storage.service";
import { STORAGE_ADAPTERS } from "./file-storage.utils";
import { IStorageAdapter } from "./file-storage.types";
import { FileStorageRepository } from "./file-storage.repository";
import { MinioClientAdapter } from "./storage-adapters/min.io/minio-client.adapter";
import { MinioStorageAdapter } from "./storage-adapters/min.io/minio-storage.adapter";
import { DiskStorageAdapter } from "./storage-adapters/disk/disk-storage-adapter";

const noopStorageAdapter: IStorageAdapter = {
	name: "noop",
	saveFile: async () => {
		throw new Error(
			"FileStorageModule: no usable storage adapter configured (noop is read/write-disabled).",
		);
	},
	deleteFile: async () => {
		throw new Error(
			"FileStorageModule: no usable storage adapter configured (noop is read/write-disabled).",
		);
	},
	streamFile: () => {
		throw new Error(
			"FileStorageModule: no usable storage adapter configured (noop is read/write-disabled).",
		);
	},
	getFileUrl: () => {
		throw new Error(
			"FileStorageModule: no usable storage adapter configured (noop is read/write-disabled).",
		);
	},
};

@Module({
	imports: [],
	controllers: [FileStorageController],
	providers: [
		MinioClientAdapter,
		MinioStorageAdapter,
		DiskStorageAdapter,
		{
			provide: STORAGE_ADAPTERS,
			inject: [MinioStorageAdapter, DiskStorageAdapter],
			useFactory: (
				minioStorageAdapter: MinioStorageAdapter,
				diskStorageAdapter: DiskStorageAdapter,
			) => {
				return [minioStorageAdapter, diskStorageAdapter, noopStorageAdapter];
			},
		},
		FileStorageService,
		FileStorageRepository,
	],
	exports: [FileStorageService, FileStorageRepository],
})
export class FileStorageModule {}
