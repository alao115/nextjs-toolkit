import { SecretManager } from "./secret-manager.interface";

export interface CanaryCheckResult {
	ok: boolean;
	missing: string[];
	errors: { key: string; error: string }[];
}

/**
 * Reads each canary key from the manager and reports which were missing
 * vs. errored. Run at boot before the HTTP server starts listening to
 * fail fast on a misconfigured KMS / Vault wiring.
 *
 * ```ts
 * const result = await canaryCheck(secretManager, ["jwt-signing", "session-key"]);
 * if (!result.ok) throw new Error(`Secret canary failed: ${JSON.stringify(result)}`);
 * ```
 */
export async function canaryCheck(
	manager: SecretManager,
	keys: string[],
): Promise<CanaryCheckResult> {
	const missing: string[] = [];
	const errors: { key: string; error: string }[] = [];

	for (const key of keys) {
		try {
			const value = await manager.getSecret(key);
			if (!value) missing.push(key);
		} catch (err) {
			errors.push({
				key,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return { ok: missing.length === 0 && errors.length === 0, missing, errors };
}
