import { ServiceUnavailableException } from "@nestjs/common";
import { HealthHttpController } from "./health.controller";
import { HealthService, HealthStatus } from "./health.service";

const ok: HealthStatus = { status: "ok", details: { db: { status: "up" } } };
const degraded: HealthStatus = {
	status: "degraded",
	details: { db: { status: "down", info: { error: "ECONNREFUSED" } } },
};
const draining: HealthStatus = {
	status: "down",
	details: { draining: { status: "down", info: { message: "Instance draining" } } },
};

function controller(overrides: Partial<Record<keyof HealthService, any>> = {}) {
	const service = {
		checkAll: jest.fn().mockResolvedValue(ok),
		readiness: jest.fn().mockResolvedValue(ok),
		liveness: jest.fn().mockResolvedValue(ok),
		...overrides,
	} as unknown as HealthService;
	return { controller: new HealthHttpController(service), service };
}

describe("GET /health", () => {
	it("returns the payload when every indicator is up", async () => {
		const { controller: c } = controller();
		await expect(c.health()).resolves.toEqual(ok);
	});

	// Probes key on the status code; a 200 for a failing check leaves a broken
	// instance in the load balancer.
	it("throws 503 when an indicator is down", async () => {
		const { controller: c } = controller({
			checkAll: jest.fn().mockResolvedValue(degraded),
		});
		await expect(c.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it("preserves the full health payload on failure", async () => {
		const { controller: c } = controller({
			checkAll: jest.fn().mockResolvedValue(degraded),
		});
		const err = await c.health().catch((e) => e);
		expect(err.getStatus()).toBe(503);
		expect(err.getResponse()).toEqual(degraded);
	});
});

describe("GET /health/ready", () => {
	it("returns the payload when ready", async () => {
		const { controller: c } = controller();
		await expect(c.readiness()).resolves.toEqual(ok);
	});

	it("throws 503 while draining", async () => {
		const { controller: c } = controller({
			readiness: jest.fn().mockResolvedValue(draining),
		});
		const err = await c.readiness().catch((e) => e);
		expect(err.getStatus()).toBe(503);
		expect(err.getResponse()).toEqual(draining);
	});

	it("throws 503 when an indicator is down", async () => {
		const { controller: c } = controller({
			readiness: jest.fn().mockResolvedValue(degraded),
		});
		await expect(c.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it("delegates to readiness(), not checkAll()", async () => {
		const { controller: c, service } = controller();
		await c.readiness();
		expect(service.readiness).toHaveBeenCalledTimes(1);
		expect(service.checkAll).not.toHaveBeenCalled();
	});
});

describe("GET /health/live", () => {
	it("returns ok — liveness has no external dependencies", async () => {
		const { controller: c } = controller();
		await expect(c.liveness()).resolves.toEqual(ok);
	});

	it("delegates to liveness(), not checkAll()", async () => {
		const { controller: c, service } = controller();
		await c.liveness();
		expect(service.liveness).toHaveBeenCalledTimes(1);
		expect(service.checkAll).not.toHaveBeenCalled();
	});

	// Defensive: liveness() returns ok today, but if that ever changes the
	// status code must follow it rather than silently reporting healthy.
	it("would throw 503 if liveness ever reported down", async () => {
		const { controller: c } = controller({
			liveness: jest.fn().mockResolvedValue(degraded),
		});
		await expect(c.liveness()).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
