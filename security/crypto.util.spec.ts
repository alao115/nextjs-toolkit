import { hashPassword, verifyPassword, randomToken, hashToken } from "./crypto.util.js";

describe("hashPassword / verifyPassword", () => {
	// argon2 is deliberately slow; give these room.
	vi.setConfig({ testTimeout: 30_000 });

	it("produces an argon2id PHC string", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(hash.startsWith("$argon2id$")).toBe(true);
	});

	it("never returns the plaintext", async () => {
		const hash = await hashPassword("s3cret");
		expect(hash).not.toContain("s3cret");
	});

	it("verifies a correct password", async () => {
		const hash = await hashPassword("correct horse");
		await expect(verifyPassword(hash, "correct horse")).resolves.toBe(true);
	});

	it("rejects an incorrect password", async () => {
		const hash = await hashPassword("correct horse");
		await expect(verifyPassword(hash, "wrong horse")).resolves.toBe(false);
	});

	it("rejects a password differing only in case", async () => {
		const hash = await hashPassword("CorrectHorse");
		await expect(verifyPassword(hash, "correcthorse")).resolves.toBe(false);
	});

	it("rejects the empty string against a real hash", async () => {
		const hash = await hashPassword("something");
		await expect(verifyPassword(hash, "")).resolves.toBe(false);
	});

	it("salts: the same password hashes differently every time", async () => {
		const [a, b] = await Promise.all([
			hashPassword("same-password"),
			hashPassword("same-password"),
		]);
		expect(a).not.toBe(b);
		// ...and both still verify.
		await expect(verifyPassword(a, "same-password")).resolves.toBe(true);
		await expect(verifyPassword(b, "same-password")).resolves.toBe(true);
	});

	it("handles unicode and long passphrases", async () => {
		const pw = "🔐 pässwörd with spaces ".repeat(10);
		const hash = await hashPassword(pw);
		await expect(verifyPassword(hash, pw)).resolves.toBe(true);
	});
});

describe("randomToken", () => {
	it("defaults to 48 bytes of entropy", () => {
		// base64url of 48 bytes = 64 chars, unpadded.
		expect(randomToken()).toHaveLength(64);
	});

	it("honours a custom byte size", () => {
		expect(randomToken(32)).toHaveLength(43); // ceil(32*4/3) unpadded
	});

	it("emits url-safe characters only", () => {
		for (let i = 0; i < 20; i++) {
			expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
		}
	});

	it("does not repeat", () => {
		const seen = new Set(Array.from({ length: 500 }, () => randomToken()));
		expect(seen.size).toBe(500);
	});
});

describe("hashToken", () => {
	it("returns a 64-char hex sha256 digest", () => {
		expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
	});

	it("matches the known sha256 of a fixed input", () => {
		expect(hashToken("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("is deterministic — the lookup-by-hash pattern depends on it", () => {
		const token = randomToken();
		expect(hashToken(token)).toBe(hashToken(token));
	});

	it("differs for different tokens", () => {
		expect(hashToken(randomToken())).not.toBe(hashToken(randomToken()));
	});

	it("never returns the token itself", () => {
		const token = randomToken();
		expect(hashToken(token)).not.toBe(token);
	});
});
