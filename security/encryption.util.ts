import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptedPayload {
	version: string;
	keyId: string;
	iv: string;
	ciphertext: string;
	tag: string;
}

export function packEncrypted(payload: EncryptedPayload): string {
	return `${payload.version}|${payload.keyId}|${payload.iv}|${payload.ciphertext}|${payload.tag}`;
}

export function unpackEncrypted(blob: string): EncryptedPayload {
	const [version, keyId, iv, ciphertext, tag] = blob.split("|");
	return { version, keyId, iv, ciphertext, tag };
}

// Encrypt using a plaintext data key (Buffer)
export function encryptWithDataKey(
	plaintext: Buffer,
	dataKey: Buffer,
	keyId: string,
): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGO, dataKey, iv, {
		authTagLength: TAG_LENGTH,
	});
	const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return packEncrypted({
		version: "v1",
		keyId,
		iv: iv.toString("base64"),
		ciphertext: ct.toString("base64"),
		tag: tag.toString("base64"),
	});
}

export function decryptWithDataKey(blob: string, dataKey: Buffer): Buffer {
	const { iv, ciphertext, tag } = unpackEncrypted(blob);
	const decipher = createDecipheriv(ALGO, dataKey, Buffer.from(iv, "base64"), {
		authTagLength: TAG_LENGTH,
	});
	decipher.setAuthTag(Buffer.from(tag, "base64"));
	const pt = Buffer.concat([
		decipher.update(Buffer.from(ciphertext, "base64")),
		decipher.final(),
	]);
	return pt;
}
