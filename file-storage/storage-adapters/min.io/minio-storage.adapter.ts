/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, OnModuleInit } from "@nestjs/common";
import { IStorageAdapter, IUploadedFile } from "../../file-storage.types";
import { MinioClientAdapter } from "./minio-client.adapter";
import { ConfigService } from "@nestjs/config";
import { MinioBucketsConfigNotFoundError } from "../../errors/minio-buckets-config-not-found.error";
import { TracingService } from "../../../observability/tracing";
import { LoggerService } from "../../../observability/logger";
import { RETENTION_MODES } from "minio";

@Injectable()
export class MinioStorageAdapter implements IStorageAdapter, OnModuleInit {
	readonly name = "minio";

	constructor(
		private readonly minioClient: MinioClientAdapter,
		private readonly config: ConfigService,
		private readonly logger: LoggerService,
		private readonly tracingService: TracingService,
	) {}

	async onModuleInit() {
		try {
			await this.initBuckets();
		} catch (error) {
			this.logger.error("Minio Storage Adapter Initialization failed", {
				error,
			});
		}
	}

	private async initBuckets() {
		return this.tracingService.runInSpan(
			"MinioStorageAdapter.initBuckets",
			async () => {
				this.logger.info("Initializing Minio buckets creation");

				const bucketConfig = this.config.get("minio.buckets");

				this.logger.debug("Minio buckets config", bucketConfig);

				if (!bucketConfig) {
					this.logger.error("Minio buckets config not found");
					throw new MinioBucketsConfigNotFoundError();
				}

				const buckets = await this.minioClient.minioClient.listBuckets();
				const bucketsNames = buckets.map((bucket) => bucket.name);

				this.logger.debug("Minio buckets", bucketsNames);

				if (!bucketsNames.includes(bucketConfig.private)) {
					await this.minioClient.minioClient.makeBucket(bucketConfig.private);
					this.logger.info(`Minio bucket ${bucketConfig.private} created`);
				}
				if (!bucketsNames.includes(bucketConfig.public)) {
					await this.minioClient.minioClient.makeBucket(bucketConfig.public);
					this.logger.info(`Minio bucket ${bucketConfig.public} created`);
				}
				if (!bucketsNames.includes(bucketConfig.staging)) {
					await this.minioClient.minioClient.makeBucket(bucketConfig.staging);
					// await minioClient.setObjectLockConfig('my-bucketname', { mode: 'COMPLIANCE', unit: 'Days', validity: 10 })
					this.logger.info(`Minio bucket ${bucketConfig.staging} created`);
				}

				this.logger.info("Minio buckets creation finished");
			},
		);
	}

	async getFileStatFromBucket(bucket: string, key: string): Promise<any> {
		return this.minioClient.minioClient.statObject(bucket, key);
	}

	async deleteFileFromBucket(bucket: string, key: string): Promise<void> {
		return this.minioClient.minioClient.removeObject(bucket, key);
	}

	async saveInBucket(
		file: IUploadedFile,
		bucket: string,
		key: string,
		metaData?: Record<string, any>,
		ttl?: string,
	): Promise<string> {
		if (!file.buffer) {
			throw new Error(
				"MinioStorageAdapter.saveInBucket: file.buffer is required",
			);
		}
		const res = await this.minioClient.minioClient.putObject(
			bucket,
			key,
			file.buffer,
			file.size,
			{
				"Content-Type": file.mimetype,
				"Content-Disposition": `attachment; filename=${file.originalname}`,
				...metaData,
			},
		);
		if (ttl) {
			await this.minioClient.minioClient.putObjectRetention(bucket, key, {
				mode: RETENTION_MODES.GOVERNANCE,
				retainUntilDate: ttl,
				versionId: res.versionId,
			} as any);
		}
		return key;
	}

	async getFileUrlFromBucket(bucket: string, key: string): Promise<string> {
		return this.minioClient.minioClient.presignedGetObject(bucket, key);
	}

	getStreamFromBucket(bucket: string, key: string): NodeJS.ReadableStream {
		return this.minioClient.minioClient.getObject(
			bucket,
			key,
		) as unknown as NodeJS.ReadableStream;
	}
}

/**
 * Citizen storage naming convention inside minio:
 * - private/citizens/{citizenId}/personals/YYYY/MM/DD/v{}/{fileId}/{fileName}
 * - private/citizens/{citizenId}/applications/YYYY/MM/DD/{applicationId}/{fileName}
 *
 * - assets/{appVersion}/images/{assetName}.{ext}
 * - assets/{appVersion}/js/{bundleName}.js
 * - assets/{appVersion}/css/{bundleName}.css
 * - public-share/{publicToken}/{fileId}.{ext}
 *
 * - app/{serviceName}/year={YYYY}/month={MM}/day={DD}/{uuid}.json
 * - audit/{YYYY}/{MM}/{DD}/{uuid}.json
 */
