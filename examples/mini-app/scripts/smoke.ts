/**
 * Smoke test: start the app, hit every demo endpoint, assert each behavior,
 * then shut down. Run after `pnpm install` to confirm the published
 * @alaska115/nextjs-toolkit package works end-to-end in a fresh consumer.
 *
 *   pnpm run smoke
 *
 * Exit code 0 = all checks passed, non-zero = something broke.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";

const PORT = 13571;

interface Check {
	name: string;
	ok: boolean;
	detail?: string;
}

async function http(
	path: string,
	headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
	const res = await fetch(`http://localhost:${PORT}/api${path}`, { headers });
	let body: any = null;
	try {
		body = await res.json();
	} catch {
		body = await res.text();
	}
	return { status: res.status, body };
}

async function run(): Promise<void> {
	process.env.HTTP_PORT = String(PORT);
	process.env.NODE_ENV = "test";

	const app = await NestFactory.create(AppModule, { logger: false });
	app.setGlobalPrefix("api");
	await app.listen(PORT);

	const checks: Check[] = [];
	let allGood = true;

	const assert = (name: string, ok: boolean, detail?: string) => {
		checks.push({ name, ok, detail });
		if (!ok) allGood = false;
	};

	try {
		// 1. hello — wrapper envelope + correlationId injection
		const hello = await http("/hello");
		assert(
			"GET /hello returns 200",
			hello.status === 200,
			`status=${hello.status}`,
		);
		const data = hello.body?.data ?? hello.body;
		assert(
			"hello response is wrapped in AppResponse envelope",
			"data" in hello.body || "correlationId" in hello.body,
			`shape=${JSON.stringify(hello.body)}`,
		);
		assert(
			"requestId populated by RequestContextInterceptor",
			typeof data?.requestId === "string" && data.requestId.length > 0,
			`requestId=${data?.requestId}`,
		);

		// 2. tenant — RequestContextInterceptor reads x-tenant-id
		const tenant = await http("/tenant", { "x-tenant-id": "acme" });
		const tdata = tenant.body?.data ?? tenant.body;
		assert(
			"x-tenant-id header propagates into TenantService.current()",
			tdata?.current === "acme",
			`current=${tdata?.current}`,
		);
		assert(
			"TenantService.cacheKey() composes tenant prefix",
			tdata?.cacheKey === "t:acme:user:42",
			`cacheKey=${tdata?.cacheKey}`,
		);

		// 3. flag — static feature flag adapter
		const flagOn = await http("/flag/new-checkout");
		const fdata = flagOn.body?.data ?? flagOn.body;
		assert(
			"feature flag 'new-checkout' is enabled in static config",
			fdata?.enabled === true,
			`enabled=${fdata?.enabled}`,
		);
		const flagOff = await http("/flag/experimental-search");
		const fdata2 = flagOff.body?.data ?? flagOff.body;
		assert(
			"feature flag 'experimental-search' is disabled",
			fdata2?.enabled === false,
			`enabled=${fdata2?.enabled}`,
		);
		assert(
			"deterministic rollout bucketing returns booleans",
			typeof fdata2?.rollout10pct === "boolean" &&
				typeof fdata2?.rollout50pct === "boolean",
		);

		// 4. error — HttpExceptionFilter shapes BaseException correctly
		const err = await http("/error");
		assert(
			"BaseException → 404 status",
			err.status === 404,
			`status=${err.status}`,
		);
		assert(
			"error body has canonical { code, message, details, correlationId }",
			err.body?.code === "WIDGET_NOT_FOUND" &&
				err.body?.message?.includes("xyz-789") &&
				err.body?.details?.widgetId === "xyz-789" &&
				typeof err.body?.correlationId === "string",
			`body=${JSON.stringify(err.body)}`,
		);

		// 5. slow — retry + timeout from resilience module
		const slow = await http("/slow");
		const sdata = slow.body?.data ?? slow.body;
		assert(
			"retry succeeded after transient failures",
			sdata?.result === "eventually ok",
			`result=${sdata?.result}`,
		);
		assert(
			"retry attempted at least 3 times",
			sdata?.attempts >= 3,
			`attempts=${sdata?.attempts}`,
		);

		// 6. health — HealthModule liveness endpoint
		const live = await http("/health/live");
		assert(
			"GET /health/live returns 200",
			live.status === 200,
			`status=${live.status}`,
		);
		const ldata = live.body?.data ?? live.body;
		assert(
			"liveness reports status: ok",
			ldata?.status === "ok",
			`status=${ldata?.status}`,
		);
	} finally {
		await app.close();
	}

	const passed = checks.filter((c) => c.ok).length;
	const failed = checks.filter((c) => !c.ok);

	console.log(`\n${passed}/${checks.length} checks passed`);
	for (const c of checks) {
		const icon = c.ok ? "PASS" : "FAIL";
		console.log(`  [${icon}] ${c.name}${c.detail ? "  (" + c.detail + ")" : ""}`);
	}

	process.exit(allGood ? 0 : 1);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
