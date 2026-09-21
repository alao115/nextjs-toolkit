import { randomBytes } from "crypto";
import { createHash } from "crypto";

type Argon2Module = typeof import("argon2");

let argon2Module: Argon2Module | undefined;

/**
 * `argon2` is an optional peer dependency (and a native module), so it is
 * loaded on first use rather than imported at the top of the file. A static
 * import would make `@alaska115/nextjs-toolkit/security` fail to load for
 * anyone who does not hash passwords — `randomToken` and `hashToken` need
 * nothing but Node's `crypto`.
 */
function loadArgon2(): Argon2Module {
	if (!argon2Module) {
		try {
			argon2Module = require("argon2") as Argon2Module;
		} catch {
			throw new Error(
				"hashPassword/verifyPassword require the optional peer dependency " +
					"'argon2'. Install it with: npm install argon2",
			);
		}
	}
	return argon2Module;
}

export async function hashPassword(password: string) {
	const argon2 = loadArgon2();
	return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
	return loadArgon2().verify(hash, password);
}

export function randomToken(size = 48) {
	return randomBytes(size).toString("base64url");
}

export function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
