import { buildWhere } from "./where.builder";

describe("buildWhere", () => {
	it("returns empty object when no inputs", () => {
		expect(buildWhere({}, {})).toEqual({});
	});

	it("merges baseWhere", () => {
		expect(
			buildWhere({}, { baseWhere: { tenantId: "t1", deletedAt: null } }),
		).toEqual({ tenantId: "t1", deletedAt: null });
	});

	it("builds OR conditions for each search field with case-insensitive contains", () => {
		const where = buildWhere(
			{ search: "alice" },
			{ search: ["name", "email"] },
		);
		expect(where.OR).toEqual([
			{ name: { contains: "alice", mode: "insensitive" } },
			{ email: { contains: "alice", mode: "insensitive" } },
		]);
	});

	it("trims the search term", () => {
		const where = buildWhere(
			{ search: "  alice  " },
			{ search: ["name"] },
		);
		expect(where.OR[0]).toEqual({
			name: { contains: "alice", mode: "insensitive" },
		});
	});

	it("ignores empty/whitespace-only search", () => {
		expect(buildWhere({ search: "   " }, { search: ["name"] })).toEqual({});
		expect(buildWhere({ search: "" }, { search: ["name"] })).toEqual({});
	});

	it("ignores search when no search fields configured", () => {
		expect(buildWhere({ search: "x" }, {})).toEqual({});
	});

	it("builds date range with from and to", () => {
		const where = buildWhere(
			{ from: "2026-01-01", to: "2026-12-31" },
			{ dateAttr: "createdAt" },
		);
		expect(where.createdAt.gte).toBe("2026-01-01T00:00:00.000Z");
		expect(where.createdAt.lte).toBe("2026-12-31T00:00:00.000Z");
	});

	it("builds date range with only `from`", () => {
		const where = buildWhere({ from: "2026-01-01" }, { dateAttr: "createdAt" });
		expect(where.createdAt.gte).toBe("2026-01-01T00:00:00.000Z");
		expect(where.createdAt.lte).toBeUndefined();
	});

	it("ignores date filters with no dateAttr", () => {
		expect(buildWhere({ from: "2026-01-01" }, {})).toEqual({});
	});

	it("combines baseWhere + search + date", () => {
		const where = buildWhere(
			{ search: "bob", from: "2026-01-01" },
			{
				baseWhere: { tenantId: "t1" },
				search: ["name"],
				dateAttr: "createdAt",
			},
		);
		expect(where.tenantId).toBe("t1");
		expect(where.OR).toHaveLength(1);
		expect(where.createdAt.gte).toBeDefined();
	});
});
