import { ShutdownManager } from "./shutdown.manager";

function makeManager(): ShutdownManager {
	const mgr = new ShutdownManager();
	// LoggerService is `@Inject`ed but the tests don't need real logging.
	(mgr as any).logger = {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	};
	return mgr;
}

describe("ShutdownManager", () => {
	it("registers hooks with defaults (phase: 'infra', order: 100)", async () => {
		const mgr = makeManager();
		const fn = jest.fn().mockResolvedValue(undefined);
		mgr.registerHook({ name: "h", shutdown: fn });

		await mgr.shutdown();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("runs hooks in phase order: preStopTraffic → stopTraffic → infra → logging", async () => {
		const mgr = makeManager();
		const calls: string[] = [];

		mgr.registerHook({
			name: "logging-hook",
			phase: "logging",
			shutdown: async () => void calls.push("logging"),
		});
		mgr.registerHook({
			name: "infra-hook",
			phase: "infra",
			shutdown: async () => void calls.push("infra"),
		});
		mgr.registerHook({
			name: "stoptraffic-hook",
			phase: "stopTraffic",
			shutdown: async () => void calls.push("stopTraffic"),
		});
		mgr.registerHook({
			name: "prestop-hook",
			phase: "preStopTraffic",
			shutdown: async () => void calls.push("preStopTraffic"),
		});

		await mgr.shutdown();
		expect(calls).toEqual([
			"preStopTraffic",
			"stopTraffic",
			"infra",
			"logging",
		]);
	});

	it("within a phase, runs hooks by ascending `order`", async () => {
		const mgr = makeManager();
		const calls: string[] = [];

		mgr.registerHook({
			name: "c",
			phase: "infra",
			order: 30,
			shutdown: async () => void calls.push("c"),
		});
		mgr.registerHook({
			name: "a",
			phase: "infra",
			order: 10,
			shutdown: async () => void calls.push("a"),
		});
		mgr.registerHook({
			name: "b",
			phase: "infra",
			order: 20,
			shutdown: async () => void calls.push("b"),
		});

		await mgr.shutdown();
		expect(calls).toEqual(["a", "b", "c"]);
	});

	it("continues running subsequent hooks if one throws", async () => {
		const mgr = makeManager();
		const calls: string[] = [];

		mgr.registerHook({
			name: "first",
			phase: "infra",
			order: 1,
			shutdown: async () => void calls.push("first"),
		});
		mgr.registerHook({
			name: "boom",
			phase: "infra",
			order: 2,
			shutdown: async () => {
				calls.push("boom");
				throw new Error("nope");
			},
		});
		mgr.registerHook({
			name: "after",
			phase: "infra",
			order: 3,
			shutdown: async () => void calls.push("after"),
		});

		await expect(mgr.shutdown()).resolves.not.toThrow();
		expect(calls).toEqual(["first", "boom", "after"]);
	});

	it("isShuttingDown() reflects the flag", () => {
		const mgr = makeManager();
		expect(mgr.isShuttingDown()).toBe(false);
		(mgr as any).shuttingDown = true;
		expect(mgr.isShuttingDown()).toBe(true);
	});

	it("running shutdown with no hooks is a no-op", async () => {
		const mgr = makeManager();
		await expect(mgr.shutdown()).resolves.toBeUndefined();
	});

	it("hooks awaited sequentially within a phase (no parallel)", async () => {
		const mgr = makeManager();
		const calls: string[] = [];

		mgr.registerHook({
			name: "slow",
			phase: "infra",
			order: 1,
			shutdown: async () => {
				await new Promise((r) => setTimeout(r, 30));
				calls.push("slow-done");
			},
		});
		mgr.registerHook({
			name: "fast",
			phase: "infra",
			order: 2,
			shutdown: async () => {
				calls.push("fast-start");
			},
		});

		await mgr.shutdown();
		// "slow-done" should land before "fast-start" because phases are sequential
		expect(calls).toEqual(["slow-done", "fast-start"]);
	});
});
