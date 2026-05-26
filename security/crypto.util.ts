import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { createHash } from "crypto";

export async function hashPassword(password: string) {
	return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
	return argon2.verify(hash, password);
}

export function randomToken(size = 48) {
	return randomBytes(size).toString("base64url");
}

export function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
