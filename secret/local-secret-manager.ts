import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { SecretManager, SecretValue } from "./secret-manager.interface";
import { SecretKeyNotFoundException } from "../errors/secret-key-notFound.exception";
import { LoggerService } from "../observability/logger/logger.service";

/**
 * Process-local in-memory secret manager. Suitable for dev/tests; **not** for
 * production. Callers can seed values via `setSecret()` at boot.
 */
@Injectable()
export class LocalSecretManager implements SecretManager {
	private readonly secrets = new Map<string, SecretValue>();

	constructor(private readonly logger: LoggerService) {}

	/** Seed/overwrite a secret. Returns the resulting versioned value. */
	setSecret(key: string, value: string): SecretValue {
		const entry: SecretValue = {
			value,
			version: this.versionFor(value),
			rotatedAt: new Date().toISOString(),
		};
		this.secrets.set(key, entry);
		return entry;
	}

	async getSecret(key: string): Promise<string | undefined> {
		const entry = this.secrets.get(key);
		if (!entry) {
			this.logger.warn(`Secret ${key} not found`);
			return undefined;
		}
		return entry.value;
	}

	async getRequiredSecret(key: string): Promise<string> {
		const secret = await this.getSecret(key);
		if (!secret) {
			throw new SecretKeyNotFoundException(key);
		}
		return secret;
	}

	async getVersionedSecret(key: string): Promise<SecretValue | undefined> {
		return this.secrets.get(key);
	}

	async rotateSecret(_key: string): Promise<SecretValue> {
		throw new Error(
			"LocalSecretManager does not support rotation. Use a backend like AWS Secrets Manager or Vault.",
		);
	}

	private versionFor(value: string): string {
		return createHash("sha256").update(value).digest("hex").slice(0, 12);
	}
}
