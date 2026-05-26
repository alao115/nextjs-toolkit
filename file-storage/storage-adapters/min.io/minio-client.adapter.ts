import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as MinioClient from "minio";
import { LoggerService } from "../../../observability/logger";

@Injectable()
export class MinioClientAdapter implements OnModuleInit {
	private _minioClient: MinioClient.Client;
	constructor(
		private readonly configService: ConfigService,
		private readonly logger: LoggerService,
	) {}

	async onModuleInit() {
		try {
			const endPoint = this.configService.get<string>("minio.url");
			if (!endPoint) {
				throw new Error(
					"MinioClientAdapter: minio.url is not configured (set MINIO_URL)",
				);
			}
			this._minioClient = new MinioClient.Client({
				endPoint,
				port: this.configService.get<number>("minio.port"),
				useSSL: this.configService.get<boolean>("minio.secure"),
				accessKey: this.configService.get<string>("minio.accessKey") ?? "",
				secretKey: this.configService.get<string>("minio.secretKey") ?? "",
			});
		} catch (error) {
			this.logger.error("Minio Client Initialization failed", error);
		}
	}

	get minioClient() {
		return this._minioClient;
	}
}
