/**
 * A versioned secret value. Backends that support rotation should bump
 * `version` whenever the underlying material changes so callers can compare
 * cached values without re-fetching the secret itself.
 */
export interface SecretValue {
	value: string;
	version: string;
	rotatedAt?: string;
}

export interface SecretManager {
	/** Returns the current value, or undefined if the key is not set. */
	getSecret(key: string): Promise<string | undefined>;

	/** Returns the current value, throws if the key is not set. */
	getRequiredSecret(key: string): Promise<string>;

	/**
	 * Returns the value + version metadata. Override on adapters that support
	 * rotation (AWS Secrets Manager, Vault). Default implementation can use
	 * the value's hash as a pseudo-version.
	 */
	getVersionedSecret?(key: string): Promise<SecretValue | undefined>;

	/**
	 * Forces rotation for `key`. Implementations that don't support rotation
	 * should throw. Returns the new versioned value.
	 */
	rotateSecret?(key: string): Promise<SecretValue>;
}

export const SECRET_MANAGER = Symbol("SECRET_MANAGER");
