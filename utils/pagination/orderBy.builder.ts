import {
	OrderByInput,
	OrderDirection,
	PaginationQueryInput,
	PaginationConfig,
} from "./pagination.types";

function parseSortString(sort?: string): OrderByInput | undefined {
	if (!sort || !sort.trim()) return undefined;

	const result: OrderByInput = {};

	for (const token of sort
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean)) {
		const [field, directionRaw] = token.split(":").map((s) => s.trim());

		if (!field) continue;

		const direction = (directionRaw?.toLowerCase() as OrderDirection) || "asc";

		if (direction !== "asc" && direction !== "desc") continue;

		result[field] = direction;
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

export function buildOrderBy(
	query: PaginationQueryInput,
	config: PaginationConfig,
): OrderByInput | OrderByInput[] | undefined {
	const parsedFromQuery = parseSortString(query.sort);

	const source = parsedFromQuery ?? config.orderBy;
	if (!source) return undefined;

	// Prisma supports array of orderBy for multiple fields.
	// If config/orderBy has multiple keys, convert to array form:
	const entries = Object.entries(source);

	if (entries.length === 1) {
		const [field, direction] = entries[0];
		return { [field]: direction };
	}

	return entries.map(([field, direction]) => ({ [field]: direction }));
}
