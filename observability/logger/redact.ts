const DEFAULT_REDACTED_KEYS = new Set<string>([
	// Auth-bearing headers / fields
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
	"api-key",
	"apikey",
	"x-auth-token",
	"x-access-token",
	"x-csrf-token",

	// Credential-like fields
	"password",
	"passwd",
	"pwd",
	"secret",
	"client_secret",
	"clientsecret",
	"token",
	"refresh_token",
	"refreshtoken",
	"access_token",
	"accesstoken",
	"id_token",
	"private_key",
	"privatekey",
	"session",
	"sid",

	// PII
	"ssn",
	"social_security_number",
	"credit_card",
	"creditcard",
	"card_number",
	"cardnumber",
	"cvv",
	"cvc",
	"iban",
	"swift",
]);

const REDACTED = "[REDACTED]";

export interface RedactOptions {
	/**
	 * Extra keys (lower-cased) to redact on top of the default list.
	 */
	extraKeys?: string[];

	/**
	 * If provided, these keys are NOT redacted even if they're in the default list.
	 * Use sparingly — typically only for deliberate test fixtures.
	 */
	exceptKeys?: string[];

	/**
	 * Maximum object depth to walk. Default: 6.
	 */
	maxDepth?: number;
}

/**
 * Returns a deep copy of `value` with values for sensitive keys replaced by
 * `[REDACTED]`. Safe to pass arbitrary unknown input (handles cycles by
 * stopping at `maxDepth`).
 *
 * Use this before logging request headers, request bodies, or any object that
 * might transit through a user-controlled boundary.
 */
export function redact<T>(value: T, options: RedactOptions = {}): T {
	const denylist = new Set(DEFAULT_REDACTED_KEYS);
	for (const k of options.extraKeys ?? []) denylist.add(k.toLowerCase());
	for (const k of options.exceptKeys ?? []) denylist.delete(k.toLowerCase());

	const maxDepth = options.maxDepth ?? 6;

	const walk = (v: unknown, depth: number): unknown => {
		if (depth > maxDepth) return REDACTED;
		if (v === null || v === undefined) return v;
		if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
		if (typeof v === "object") {
			const out: Record<string, unknown> = {};
			for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
				if (denylist.has(k.toLowerCase())) {
					out[k] = REDACTED;
				} else {
					out[k] = walk(val, depth + 1);
				}
			}
			return out;
		}
		return v;
	};

	return walk(value, 0) as T;
}
