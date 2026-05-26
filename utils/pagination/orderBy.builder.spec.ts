import { buildOrderBy } from "./orderBy.builder";

describe("buildOrderBy", () => {
	it("returns undefined when no sort and no config orderBy", () => {
		expect(buildOrderBy({}, {})).toBeUndefined();
	});

	it("falls back to config.orderBy when query.sort is empty", () => {
		expect(
			buildOrderBy({}, { orderBy: { createdAt: "desc" } }),
		).toEqual({ createdAt: "desc" });
	});

	it("query.sort overrides config.orderBy", () => {
		expect(
			buildOrderBy({ sort: "name:asc" }, { orderBy: { createdAt: "desc" } }),
		).toEqual({ name: "asc" });
	});

	it("defaults to asc when direction omitted", () => {
		expect(buildOrderBy({ sort: "name" }, {})).toEqual({ name: "asc" });
	});

	it("parses multiple fields into an array", () => {
		const result = buildOrderBy({ sort: "name:asc,createdAt:desc" }, {});
		expect(result).toEqual([{ name: "asc" }, { createdAt: "desc" }]);
	});

	it("rejects invalid direction tokens", () => {
		// invalid direction → field is silently dropped
		expect(buildOrderBy({ sort: "name:weird" }, {})).toBeUndefined();
	});

	it("is case-insensitive on direction", () => {
		expect(buildOrderBy({ sort: "name:DESC" }, {})).toEqual({ name: "desc" });
	});

	it("trims whitespace", () => {
		expect(buildOrderBy({ sort: "  name : asc , email:desc  " }, {})).toEqual([
			{ name: "asc" },
			{ email: "desc" },
		]);
	});

	it("returns undefined for whitespace-only sort", () => {
		expect(buildOrderBy({ sort: "   " }, {})).toBeUndefined();
	});
});
