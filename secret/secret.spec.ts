import { LocalSecretManager } from "./local-secret-manager";
import { SecretRotationEmitter } from "./secret-rotation.emitter";
import { canaryCheck } from "./secret-canary";
import { SecretManager } from "./secret-manager.interface";
import { SecretKeyNotFoundException } from "../errors/secret-key-notFound.exception";

const logger = () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) as any;

describe("LocalSecretManager", () => {
	it("returns a seeded secret", async () => {
		const m = new LocalSecretManager(logger());
		m.setSecret("jwt", "s3cret-value");
		await expect(m.getSecret("jwt")).resolves.toBe("s3cret-value");
	});

	it("returns undefined for an unknown key", async () => {
		await expect(new LocalSecretManager(logger()).getSecret("nope")).resolves
			.toBeUndefined();
	});

	it("logs a warning on a miss rather than failing silently", async () => {
		const log = logger();
		await new LocalSecretManager(log).getSecret("nope");
		expect(log.warn).toHaveBeenCalled();
	});

	it("getRequiredSecret throws SecretKeyNotFoundException on a miss", async () => {
		await expect(
			new LocalSecretManager(logger()).getRequiredSecret("nope"),
		).rejects.toBeInstanceOf(SecretKeyNotFoundException);
	});

	it("getRequiredSecret returns a seeded value", async () => {
		const m = new LocalSecretManager(logger());
		m.setSecret("k", "v");
		await expect(m.getRequiredSecret("k")).resolves.toBe("v");
	});

	it("exposes a version derived from the value", async () => {
		const m = new LocalSecretManager(logger());
		const set = m.setSecret("k", "v1");
		const got = await m.getVersionedSecret("k");
		expect(got).toEqual(set);
		expect(set.version).toMatch(/^[0-9a-f]{12}$/);
	});

	it("gives the same value the same version, and a new value a new one", () => {
		const m = new LocalSecretManager(logger());
		const a = m.setSecret("k", "same");
		const b = m.setSecret("k", "same");
		const c = m.setSecret("k", "different");
		expect(b.version).toBe(a.version);
		expect(c.version).not.toBe(a.version);
	});

	it("overwrites on re-seed", async () => {
		const m = new LocalSecretManager(logger());
		m.setSecret("k", "old");
		m.setSecret("k", "new");
		await expect(m.getSecret("k")).resolves.toBe("new");
	});

	it("refuses to pretend it can rotate", async () => {
		await expect(
			new LocalSecretManager(logger()).rotateSecret("k"),
		).rejects.toThrow(/does not support rotation/i);
	});
});

describe("SecretRotationEmitter", () => {
	const event = (key: string, newVersion: string) => ({
		key,
		newVersion,
		rotatedAt: new Date().toISOString(),
		value: { value: "v", version: newVersion },
	});

	it("delivers to a global listener", () => {
		const emitter = new SecretRotationEmitter();
		const seen: string[] = [];
		emitter.onRotation((e) => seen.push(e.key));
		emitter.emit(event("a", "1"));
		emitter.emit(event("b", "1"));
		expect(seen).toEqual(["a", "b"]);
	});

	it("scopes onRotationOf to a single key", () => {
		const emitter = new SecretRotationEmitter();
		const seen: string[] = [];
		emitter.onRotationOf("a", (e) => seen.push(e.key));
		emitter.emit(event("a", "1"));
		emitter.emit(event("b", "1"));
		expect(seen).toEqual(["a"]);
	});

	it("unsubscribes when the returned function is called", () => {
		const emitter = new SecretRotationEmitter();
		const handler = jest.fn();
		const off = emitter.onRotation(handler);
		emitter.emit(event("a", "1"));
		off();
		emitter.emit(event("a", "2"));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("unsubscribes a key-scoped listener", () => {
		const emitter = new SecretRotationEmitter();
		const handler = jest.fn();
		emitter.onRotationOf("a", handler)();
		emitter.emit(event("a", "1"));
		expect(handler).not.toHaveBeenCalled();
	});

	it("supports several independent listeners", () => {
		const emitter = new SecretRotationEmitter();
		const a = jest.fn();
		const b = jest.fn();
		emitter.onRotation(a);
		emitter.onRotation(b);
		emitter.emit(event("k", "1"));
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it("tracks the last version seen per key", () => {
		const emitter = new SecretRotationEmitter();
		expect(emitter.getLastVersion("k")).toBeUndefined();
		emitter.emit(event("k", "v1"));
		expect(emitter.getLastVersion("k")).toBe("v1");
		emitter.emit(event("k", "v2"));
		expect(emitter.getLastVersion("k")).toBe("v2");
	});

	it("keeps versions separate per key", () => {
		const emitter = new SecretRotationEmitter();
		emitter.emit(event("a", "a1"));
		emitter.emit(event("b", "b1"));
		expect(emitter.getLastVersion("a")).toBe("a1");
		expect(emitter.getLastVersion("b")).toBe("b1");
	});
});

describe("canaryCheck", () => {
	const managerWith = (
		values: Record<string, string | undefined>,
		throwOn: string[] = [],
	): SecretManager => ({
		async getSecret(key) {
			if (throwOn.includes(key)) throw new Error(`vault unreachable for ${key}`);
			return values[key];
		},
		async getRequiredSecret(key) {
			const v = await this.getSecret(key);
			if (!v) throw new Error("missing");
			return v;
		},
	});

	it("passes when every key is present", async () => {
		const result = await canaryCheck(managerWith({ a: "1", b: "2" }), ["a", "b"]);
		expect(result).toEqual({ ok: true, missing: [], errors: [] });
	});

	it("passes trivially for an empty key list", async () => {
		await expect(canaryCheck(managerWith({}), [])).resolves.toEqual({
			ok: true,
			missing: [],
			errors: [],
		});
	});

	it("reports missing keys", async () => {
		const result = await canaryCheck(managerWith({ a: "1" }), ["a", "b", "c"]);
		expect(result.ok).toBe(false);
		expect(result.missing).toEqual(["b", "c"]);
		expect(result.errors).toEqual([]);
	});

	it("treats an empty-string secret as missing", async () => {
		const result = await canaryCheck(managerWith({ a: "" }), ["a"]);
		expect(result.missing).toEqual(["a"]);
	});

	it("reports read errors separately from misses", async () => {
		const result = await canaryCheck(managerWith({ a: "1" }, ["b"]), ["a", "b"]);
		expect(result.ok).toBe(false);
		expect(result.missing).toEqual([]);
		expect(result.errors).toEqual([
			{ key: "b", error: "vault unreachable for b" },
		]);
	});

	it("reports misses and errors together", async () => {
		const result = await canaryCheck(managerWith({}, ["b"]), ["a", "b"]);
		expect(result.missing).toEqual(["a"]);
		expect(result.errors).toHaveLength(1);
		expect(result.ok).toBe(false);
	});

	it("checks every key even after the first failure", async () => {
		const getSecret = jest.fn().mockResolvedValue(undefined);
		await canaryCheck({ getSecret } as any, ["a", "b", "c"]);
		expect(getSecret).toHaveBeenCalledTimes(3);
	});
});
