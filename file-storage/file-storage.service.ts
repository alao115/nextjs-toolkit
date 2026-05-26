import { Inject, Injectable } from "@nestjs/common";
import { IStorageAdapter, IUploadedFile } from "./file-storage.types";
import { STORAGE_ADAPTERS, getBucketNameFromDestination } from "./file-storage.utils";
import { LoggerService } from "../observability/logger/logger.service";
import { FileStorageRepository } from "./file-storage.repository";
import { ConfigService } from "@nestjs/config";
import { TracingService } from "../observability/tracing";
import { FileNotFoundError } from "./errors/file-not-found.error";

@Injectable()
export class FileStorageService {
	constructor(
		@Inject(STORAGE_ADAPTERS)
		private readonly storages: IStorageAdapter[],
		private readonly logger: LoggerService,
		private readonly tracingService: TracingService,
		private readonly fileRepository: FileStorageRepository,
		private readonly config: ConfigService,
	) {}

	async isFileExistsInBucket(key: string) {
		return this.tracingService.runInSpan(
			"FileStorageService.isFileExistsInBucket",
			async () => {
				try {
					const bucket = getBucketNameFromDestination(this.buckets, key);
					await this.storage.getFileStatFromBucket!(bucket, key);
					return { ok: true };
				} catch {
					return { ok: false };
				}
			},
		);
	}

	/**
	 * Generic upload: saves the file to the named bucket at the given key.
	 * Does not create a database row — consumers needing persistence should
	 * call {@link FileStorageRepository.create} themselves or use a higher-level
	 * service.
	 */
	async uploadToBucket(
		file: IUploadedFile,
		bucket: string,
		key: string,
		metadata?: Record<string, any>,
	) {
		return this.tracingService.runInSpan(
			"FileStorageService.uploadToBucket",
			async () => {
				await this.storage.saveInBucket!(file, bucket, key, metadata);
				this.logger.info(`File uploaded: ${key}`, { bucket });
				return { key, bucket };
			},
		);
	}

	async uploadPublicFile(file: IUploadedFile) {
		return this.tracingService.runInSpan(
			"FileStorageService.uploadPublicFile",
			async () => {
				const filename = this.randomFileName;
				const key = this.getPublicKeyForPublicShare(file.originalname, filename);
				await this.storage.saveInBucket!(file, this.buckets.public, key);

				const fileEntity = await this.fileRepository.create({
					originalname: file.originalname,
					mimetype: file.mimetype,
					destination: key,
					url: this.getPublicFileUrl(filename),
					filename,
					size: file.size,
				});

				this.logger.info(`File entity created: ${fileEntity.id}`);
				return fileEntity.id;
			},
		);
	}

	async streamFile(fileId: string) {
		const file = await this.fileRepository.findOne({
			where: { OR: [{ filename: fileId }, { id: fileId }] },
		});

		if (file.isNull()) {
			throw new FileNotFoundError("File not found");
		}
		const bucket = getBucketNameFromDestination(this.buckets, file.destination);

		if (!bucket) {
			throw new FileNotFoundError("File not found");
		}
		const stream = await this.storage.getStreamFromBucket!(
			bucket,
			file.destination,
		);

		return {
			stream,
			filename: file.filename,
			mimetype: file.mimetype,
			size: file.size,
		};
	}

	async getFile(fileId: string) {
		return this.tracingService.runInSpan(
			"FileStorageService.getFile",
			async () => {
				const file = await this.fileRepository.findById(fileId);

				if (file.isNull()) {
					file.throwNotFoundError();
				}

				return file.toJSON();
			},
		);
	}

	async isFileExists(fileId: string) {
		const file = await this.fileRepository.findById(fileId);
		return { ok: file !== null };
	}

	getPublicKeyForPublicShare(
		filename: string,
		fileId: string,
		type: string = "assets",
	): string {
		const { year, month, day } = this.todayDateComponents;
		return `public-share/${type}/${year}/${month}/${day}/${fileId}/${filename}`;
	}

	private getPublicFileUrl(fileId: string) {
		const baseUrl = this.config.get<string>("app.baseUrl");
		const apiVersion = this.config.get("http.apiVersion");
		const prefix = this.config.get("http.globalPrefix");
		return `${baseUrl}/${prefix}/v${apiVersion}/files-storage/public-download/${fileId}`;
	}

	private get storage(): IStorageAdapter {
		if (!this.storages.length) {
			throw new Error("No storage adapter configured");
		}
		const storageProvider = this.config.get("files.storage.adapter");
		const storage =
			this.storages.find((s) => s.name === storageProvider) ??
			this.storages.find((s) => s.name === "noop");
		if (!storage) {
			throw new Error(
				`No storage adapter matches files.storage.adapter=${storageProvider} and no noop adapter is registered`,
			);
		}
		return storage;
	}

	private get randomFileName() {
		return Date.now() + "" + Math.round(Math.random() * 1e9);
	}

	private get buckets() {
		return this.config.get("minio.buckets");
	}

	private get todayDateComponents() {
		const today = new Date().toISOString().split("T")[0];
		const [year, month, day] = today.split("-");
		return { year, month, day };
	}
}
