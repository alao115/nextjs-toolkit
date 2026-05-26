/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 08 — Secrets via Vault.
 *
 * Shows:
 *  - Switching the SecretManager from `local` to `vault` via config.
 *  - Canary check at boot — fail fast if Vault is unreachable or a
 *    required secret is missing.
 *  - Rotation listener that drops a cached signing key when the secret rotates.
 */

import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import {
	SECRET_MANAGER,
	SecretManager,
	SecretRotationEmitter,
	VaultSecretManager,
	canaryCheck,
} from "@alaska115/nextjs-toolkit/secret";

// ─── Config (excerpt) ─────────────────────────────────────────────────────
//
// .env:
//   KMS_PROVIDER=vault
//   VAULT_ADDR=https://vault.internal:8200
//   VAULT_TOKEN=hvs.XXXXXXXX
//
// `SecretsModule.forRoot()` picks VaultSecretManager automatically when
// `kms.provider === "vault"`. No code change needed beyond this.

// ─── Boot-time canary ────────────────────────────────────────────────────

/**
 * Run AFTER `app.init()` but BEFORE `app.listen()`. If any required key
 * is missing, fail the process so the orchestrator doesn't mark the pod
 * ready and route traffic to it.
 */
export async function runSecretCanary(
	manager: SecretManager,
): Promise<void> {
	const result = await canaryCheck(manager, [
		"jwt-signing",
		"db-encryption",
		"webhook-hmac",
	]);

	if (!result.ok) {
		throw new Error(
			`Secret canary failed — missing: ${JSON.stringify(result.missing)}, errors: ${JSON.stringify(result.errors)}`,
		);
	}
}

// ─── Rotation listener: drop cached values on rotation ───────────────────

@Injectable()
export class JwtSigningService implements OnModuleInit {
	private cachedKey: string | null = null;
	private cachedVersion: string | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(
		@Inject(SECRET_MANAGER) private readonly secrets: SecretManager,
		private readonly rotations: SecretRotationEmitter,
	) {}

	onModuleInit(): void {
		// Subscribe to rotations of OUR key. When VaultSecretManager next
		// reads the key and sees a new version, it emits — we drop the cache.
		this.unsubscribe = this.rotations.onRotationOf("jwt-signing", (ev) => {
			this.cachedKey = null;
			this.cachedVersion = null;
			// Optionally pre-warm with the new value embedded in the event.
			this.cachedKey = ev.value.value;
			this.cachedVersion = ev.newVersion;
		});
	}

	async signingKey(): Promise<string> {
		if (this.cachedKey) return this.cachedKey;
		const versioned = await this.secrets.getVersionedSecret?.("jwt-signing");
		if (!versioned) throw new Error("jwt-signing key missing");
		this.cachedKey = versioned.value;
		this.cachedVersion = versioned.version;
		return this.cachedKey;
	}
}

// ─── Direct construction (e.g. for one-off scripts) ──────────────────────

export function directConstruction(emitter: SecretRotationEmitter) {
	const vault = new VaultSecretManager({
		addr: "https://vault.internal:8200",
		token: process.env.VAULT_TOKEN!,
		mount: "secret",
		// Vault Enterprise multi-tenancy namespace
		namespace: "platform",
		rotationEmitter: emitter,
		// Aggressive cache for tight loops
		cacheTtlMs: 30_000,
	});
	return vault;
}
