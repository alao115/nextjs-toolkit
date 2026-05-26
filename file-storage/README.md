# `@alaska115/nextjs-toolkit/file-storage`

Generic file storage with pluggable adapters (MinIO/S3, local disk, noop) backed by a Prisma-persisted file metadata table. Domain-agnostic — no signup/citizen/portal flows live here.

## Wire it up

```ts
import { FileStorageModule } from "@alaska115/nextjs-toolkit/file-storage";

@Module({ imports: [FileStorageModule] })
export class AppModule {}
```

Adapter selection happens at runtime via `files.storage.adapter` config (`minio` or `disk`). The `noop` adapter throws on every method — it exists only as a fail-fast fallback so a misconfigured storage call surfaces immediately.

## Primitives

```ts
constructor(private readonly storage: FileStorageService) {}

// Upload to an explicit bucket + key (no DB row created)
await this.storage.uploadToBucket(file, "my-bucket", "path/to/key", { mimetype });

// Upload + create a metadata row (returns the file entity id)
const id = await this.storage.uploadPublicFile(file);

// Stream back by id or filename
const { stream, mimetype, size } = await this.storage.streamFile(id);

// Existence
const { ok } = await this.storage.isFileExistsInBucket("path/to/key");
```

## Bucket schema (config)

```env
MINIO_PRIVATE_BUCKET=my-private
MINIO_PUBLIC_BUCKET=my-public
MINIO_STAGING_BUCKET=my-staging
```

The package reads these from `minio.buckets.{private,public,staging}`. Bucket *names* are yours; the **three roles** (private / public / staging) are the convention the helper functions expect.

The `getBucketNameFromDestination(buckets, key)` helper inspects the first path segment of `key` and returns the appropriate bucket. The magic prefix `public-share/...` maps to the public bucket.

## Building domain-specific flows on top

The package intentionally doesn't ship `uploadCitizenAttachment()` or similar — those are project-specific. Build them in your service:

```ts
@Injectable()
export class CitizenFilesService {
  constructor(private readonly storage: FileStorageService) {}

  async stageSignupAttachment(file: IUploadedFile) {
    const key = `staging/signup/${randomUUID()}/${file.originalname}`;
    return this.storage.uploadToBucket(file, "my-staging", key, {
      mimetype: file.mimetype,
    });
  }
}
```

## Anti-patterns

- **Don't bake project-specific paths into `FileStorageService`.** That coupling is what the v0.1 refactor pulled out. Path-building lives in domain services that wrap `uploadToBucket`.
- **Don't rely on the `noop` adapter being the silent fallback.** It throws now (a previous version returned `{} as ReadableStream`, silently corrupting data).
- **Don't return raw `FileEntity` to controllers.** Use `.toJSON()` — the entity has a `destination` field that leaks internal storage structure.
