import { BaseException } from "../../errors";

export class MinioBucketsConfigNotFoundError extends BaseException {
	constructor() {
		super(
			"Minio buckets config not found",
			"MINIO_BUCKETS_CONFIG_NOT_FOUND",
			500,
		);
	}
}
