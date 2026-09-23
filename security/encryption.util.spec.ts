import { randomBytes } from "node:crypto";
import {
	packEncrypted,
	unpackEncrypted,
	encryptWithDataKey,
	decryptWithDataKey,
	EncryptedPayload,
} from "./encryption.util.js";

/** AES-256 needs exactly 32 bytes. */
const key = () => randomBytes(32);

describe("packEncrypted / unpackEncrypted", () => {
	const payload: EncryptedPayload = {
		version: "v1",
		keyId: "key-2026-01",
		iv: "aXYtYmFzZTY0",
		ciphertext: "Y2lwaGVy",
		tag: "dGFn",
	};

	it("round-trips a payload", () => {
		expect(unpackEncrypted(packEncrypted(payload))).toEqual(payload);
	});

	it("packs as pipe-delimited fields in a stable order", () => {
		expect(packEncrypted(payload)).toBe(
			"v1|key-2026-01|aXYtYmFzZTY0|Y2lwaGVy|dGFn",
		);
	});

	it("exposes keyId without decrypting — needed for rotation migrations", () => {
		const blob = encryptWithDataKey(Buffer.from("x"), key(), "key-2026-02");
		expect(unpackEncrypted(blob).keyId).toBe("key-2026-02");
		expect(unpackEncrypted(blob).version).toBe("v1");
	});
});

describe("encryptWithDataKey / decryptWithDataKey", () => {
	it("round-trips utf8 text", () => {
		const k = key();
		const blob = encryptWithDataKey(Buffer.from("123-45-6789", "utf8"), k, "k1");
		expect(decryptWithDataKey(blob, k).toString("utf8")).toBe("123-45-6789");
	});

	it("round-trips binary data", () => {
		const k = key();
		const plaintext = randomBytes(1024);
		const blob = encryptWithDataKey(plaintext, k, "k1");
		expect(decryptWithDataKey(blob, k).equals(plaintext)).toBe(true);
	});

	it("round-trips an empty buffer", () => {
		const k = key();
		const blob = encryptWithDataKey(Buffer.alloc(0), k, "k1");
		expect(decryptWithDataKey(blob, k).length).toBe(0);
	});

	it("round-trips unicode", () => {
		const k = key();
		const text = "naïve café 日本語 🔐";
		const blob = encryptWithDataKey(Buffer.from(text, "utf8"), k, "k1");
		expect(decryptWithDataKey(blob, k).toString("utf8")).toBe(text);
	});

	it("does not leak the plaintext into the blob", () => {
		const blob = encryptWithDataKey(Buffer.from("SUPERSECRET"), key(), "k1");
		expect(blob).not.toContain("SUPERSECRET");
	});

	it("uses a fresh IV per call, so the same plaintext yields different ciphertext", () => {
		const k = key();
		const a = unpackEncrypted(encryptWithDataKey(Buffer.from("same"), k, "k1"));
		const b = unpackEncrypted(encryptWithDataKey(Buffer.from("same"), k, "k1"));
		expect(a.iv).not.toBe(b.iv);
		expect(a.ciphertext).not.toBe(b.ciphertext);
	});

	it("emits a 12-byte IV and 16-byte GCM tag", () => {
		const parts = unpackEncrypted(
			encryptWithDataKey(Buffer.from("x"), key(), "k1"),
		);
		expect(Buffer.from(parts.iv, "base64")).toHaveLength(12);
		expect(Buffer.from(parts.tag, "base64")).toHaveLength(16);
	});

	it("fails to decrypt with the wrong key", () => {
		const blob = encryptWithDataKey(Buffer.from("secret"), key(), "k1");
		expect(() => decryptWithDataKey(blob, key())).toThrow();
	});

	// The point of GCM: tampering is detected, not silently decrypted.
	it("rejects a tampered ciphertext", () => {
		const k = key();
		const parts = unpackEncrypted(
			encryptWithDataKey(Buffer.from("transfer 100"), k, "k1"),
		);
		const bytes = Buffer.from(parts.ciphertext, "base64");
		bytes[0] ^= 0xff;
		const tampered = packEncrypted({
			...parts,
			ciphertext: bytes.toString("base64"),
		});
		expect(() => decryptWithDataKey(tampered, k)).toThrow();
	});

	it("rejects a tampered auth tag", () => {
		const k = key();
		const parts = unpackEncrypted(encryptWithDataKey(Buffer.from("x"), k, "k1"));
		const tag = Buffer.from(parts.tag, "base64");
		tag[0] ^= 0xff;
		expect(() =>
			decryptWithDataKey(packEncrypted({ ...parts, tag: tag.toString("base64") }), k),
		).toThrow();
	});

	it("rejects a swapped IV", () => {
		const k = key();
		const a = unpackEncrypted(encryptWithDataKey(Buffer.from("aaaa"), k, "k1"));
		const b = unpackEncrypted(encryptWithDataKey(Buffer.from("bbbb"), k, "k1"));
		expect(() => decryptWithDataKey(packEncrypted({ ...a, iv: b.iv }), k)).toThrow();
	});

	it("rejects a data key of the wrong length", () => {
		expect(() =>
			encryptWithDataKey(Buffer.from("x"), randomBytes(16), "k1"),
		).toThrow();
	});
});
