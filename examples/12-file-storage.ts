/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 12 — File storage.
 *
 * Shows:
 *  - Wiring `FileStorageModule` with the MinIO adapter selected via config.
 *  - Generic primitives (`uploadToBucket`, `streamFile`) — what the package ships.
 *  - Building project-specific flows on top (the *correct* place for citizen /
 *    signup / domain-specific path schemes).
 *  - Tenant-scoped key composition so files don't collide across tenants.
 */

import {
	Controller,
	Injectable,
	Module,
	Post,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import {
	FileStorageModule,
	FileStorageService,
	IUploadedFile,
} from "@alaska115/nextjs-toolkit/file-storage";
import { TenantService } from "@alaska115/nextjs-toolkit/multi-tenancy";

// ─── Wiring ───────────────────────────────────────────────────────────────

@Module({
	imports: [FileStorageModule],
})
export class FileStorageExampleModule {}

// Config (excerpt — read from env via ConfigurationModule):
//
//   FILE_STORAGE_ADAPTER=minio
//   MINIO_URL=minio
//   MINIO_PORT=9000
//   MINIO_ACCESS_KEY=...
//   MINIO_SECRET_KEY=...
//   MINIO_PRIVATE_BUCKET=acme-private
//   MINIO_PUBLIC_BUCKET=acme-public
//   MINIO_STAGING_BUCKET=acme-staging

// ─── Domain wrapper: signup attachments ──────────────────────────────────
//
// The package intentionally does NOT ship `signupAttachmentUpload()` —
// that's project-specific. Build it on top of the generic primitives.

@Injectable()
export class SignupAttachmentService {
	constructor(
		private readonly storage: FileStorageService,
		private readonly tenant: TenantService,
	) {}

	/**
	 * Stage a citizen signup attachment in the staging bucket. The path
	 * scheme `staging/${tenant}/signup/${date}/${id}/${filename}` keeps
	 * tenants isolated and lets a lifecycle policy auto-expire staged
	 * uploads that never made it to "private".
	 */
	async stageSignup(file: IUploadedFile) {
		const fileId = randomUUID();
		const date = new Date().toISOString().split("T")[0];
		const tenant = this.tenant.current() ?? "global";
		const bucket = process.env.MINIO_STAGING_BUCKET!;
		const key = `staging/${tenant}/signup/${date}/${fileId}/${file.originalname}`;

		await this.storage.uploadToBucket(file, bucket, key, {
			mimetype: file.mimetype,
			originalname: file.originalname,
			tenant,
		});

		return { stagingKey: key, bucket };
	}

	/**
	 * Promote a staged attachment to the citizen's private personal-files
	 * area. Reads the staged blob, re-uploads to a new key, deletes the
	 * staging copy.
	 */
	async promoteToPersonalFiles(stagingKey: string, citizenId: string) {
		const stagingBucket = process.env.MINIO_STAGING_BUCKET!;
		const privateBucket = process.env.MINIO_PRIVATE_BUCKET!;
		const newKey = `private/citizens/${citizenId}/personals/${randomUUID()}`;

		// The package doesn't ship a `move` primitive — implement on top of
		// stream + upload + delete. In production, prefer the adapter's
		// native server-side copy (MinIO `copyObject`) for efficiency.
		const stream = await (this.storage as any).storage.getStreamFromBucket(
			stagingBucket,
			stagingKey,
		);
		await this.storage.uploadToBucket(
			{ buffer: stream, originalname: stagingKey, mimetype: "application/octet-stream", size: 0 } as any,
			privateBucket,
			newKey,
		);
		await (this.storage as any).storage.deleteFileFromBucket(stagingBucket, stagingKey);

		return { key: newKey, bucket: privateBucket };
	}
}

// ─── Controller ──────────────────────────────────────────────────────────

@Controller("/signup")
export class SignupController {
	constructor(private readonly attachments: SignupAttachmentService) {}

	@Post("/attachment")
	@UseInterceptors(FileInterceptor("file"))
	async upload(@UploadedFile() file: IUploadedFile) {
		return this.attachments.stageSignup(file);
	}
}

// ─── Generic public file (uses the package's helper directly) ────────────

@Controller("/files")
export class PublicFileController {
	constructor(private readonly storage: FileStorageService) {}

	@Post("/")
	@UseInterceptors(FileInterceptor("file"))
	async uploadPublic(@UploadedFile() file: IUploadedFile) {
		// uploadPublicFile() persists a metadata row AND uploads to the
		// public bucket using the `public-share/...` key scheme.
		// Returns the FileEntity id; clients use it to GET back via streamFile.
		return { id: await this.storage.uploadPublicFile(file) };
	}
}

// ─── Anti-patterns ────────────────────────────────────────────────────────
//
// ❌ DON'T put `signupAttachmentUpload`, `saveSignupFileToStorage`, etc.
//    back into the package. The whole point of v0.1 was extracting them.
//    Domain-specific paths and flows live in your service.
//
// ❌ DON'T derive bucket from the `key`'s prefix yourself. Use
//    `getBucketNameFromDestination(buckets, key)` — it knows the
//    `public-share/...` magic prefix.
//
// ❌ DON'T leak `FileEntity.destination` to clients. It exposes internal
//    bucket structure. Use `.toJSON()` (which strips it) or only return
//    `id` + `url`.
