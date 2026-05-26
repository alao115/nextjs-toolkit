import { Injectable } from "@nestjs/common";
import { SecretManager, SecretValue } from "./secret-manager.interface";
import { SecretKeyNotFoundException } from "../errors/secret-key-notFound.exception";
import { SecretRotationEmitter } from "./secret-rotation.emitter";

export interface VaultSecretManagerConfig {
	/** Vault server base URL, e.g. `https://vault.internal:8200`. */
	addr: string;
	/** Vault token. Rotate periodically — see `AppRole` or `Kubernetes` auth. */
	token: string;
	/**
	 * KV v2 mount path. Default: `"secret"`.
	 * The HTTP path becomes `${addr}/v1/${mount}/data/${key}`.
	 */
	mount?: string;
	/**
	 * Optional namespace header for Vault Enterprise multi-tenancy.
	 */
	namespace?: string;
	/**
	 * Optional `SecretRotationEmitter` — if set, the manager publishes a
	 * rotation event whenever it observes a new version for a key.
	 */
	rotationEmitter?: SecretRotationEmitter;
	/**
	 * Cache TTL in milliseconds. Default: 60s. Set to 0 to disable
	 * caching (every call hits Vault).
	 */
	cacheTtlMs?: number;
}

interface CacheEntry {
	value: SecretValue;
	fetchedAt: number;
}

/**
 * Vault KV-v2 secret manager. Uses the HTTP API directly (`fetch`) so the
 * `node-vault` SDK isn't a peer dep. Reads return `SecretValue` with Vault's
 * own `version` field — so `getVersionedSecret()` lets callers detect
 * rotation without re-comparing values.
 *
 * Wiring:
 * ```ts
 * const secrets = new VaultSecretManager({
 *   addr: configService.get("kms.vaultAddr"),
 *   token: configService.get("kms.vaultToken"),
 *   rotationEmitter,
 * });
 *
 * // At boot, validate required secrets are present:
 * const canary = await canaryCheck(secrets, ["jwt-signing", "db-encryption"]);
 * if (!canary.ok) throw new Error("Vault canary failed: " + JSON.stringify(canary));
 * ```
 *
 * **Limitations**
 * - `rotateSecret()` is not implemented — Vault rotations are typically
 *   driven by an external system (or by Vault's own dynamic secrets engine).
 *   Override the method in a subclass if you need it.
 * - The cache is per-process. For instantaneous fleet-wide invalidation,
 *   pair with `SecretRotationEmitter` over Redis pubsub.
 */
@Injectable()
export class VaultSecretManager implements SecretManager {
	private readonly cache = new Map<string, CacheEntry>();
	private readonly cacheTtlMs: number;

	constructor(private readonly cfg: VaultSecretManagerConfig) {
		this.cacheTtlMs = cfg.cacheTtlMs ?? 60_000;
	}

	async getSecret(key: string): Promise<string | undefined> {
		const entry = await this.read(key);
		return entry?.value;
	}

	async getRequiredSecret(key: string): Promise<string> {
		const v = await this.getSecret(key);
		if (!v) throw new SecretKeyNotFoundException(key);
		return v;
	}

	async getVersionedSecret(key: string): Promise<SecretValue | undefined> {
		return this.read(key);
	}

	private async read(key: string): Promise<SecretValue | undefined> {
		const now = Date.now();
		const cached = this.cache.get(key);
		if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
			return cached.value;
		}

		const mount = this.cfg.mount ?? "secret";
		const url = `${this.cfg.addr.replace(/\/$/, "")}/v1/${mount}/data/${encodeURIComponent(key)}`;

		const headers: Record<string, string> = {
			"X-Vault-Token": this.cfg.token,
		};
		if (this.cfg.namespace) headers["X-Vault-Namespace"] = this.cfg.namespace;

		const res = await fetch(url, { method: "GET", headers });
		if (res.status === 404) {
			this.cache.delete(key);
			return undefined;
		}
		if (!res.ok) {
			throw new Error(
				`VaultSecretManager: ${res.status} ${res.statusText} reading ${mount}/${key}`,
			);
		}
		const body = (await res.json()) as {
			data: {
				data: Record<string, unknown>;
				metadata: { version: number; created_time: string };
			};
		};

		// Convention: store the literal secret under `value`. Consumers wanting
		// structured data should call `read()` and parse `data` themselves
		// (subclass or extension point).
		const raw = body.data.data;
		const value =
			typeof raw.value === "string"
				? raw.value
				: JSON.stringify(raw);

		const entry: SecretValue = {
			value,
			version: String(body.data.metadata.version),
			rotatedAt: body.data.metadata.created_time,
		};

		const previous = this.cache.get(key)?.value.version;
		this.cache.set(key, { value: entry, fetchedAt: now });

		if (
			this.cfg.rotationEmitter &&
			previous !== undefined &&
			previous !== entry.version
		) {
			this.cfg.rotationEmitter.emit({
				key,
				previousVersion: previous,
				newVersion: entry.version,
				rotatedAt: entry.rotatedAt ?? new Date(now).toISOString(),
				value: entry,
			});
		}

		return entry;
	}
}
