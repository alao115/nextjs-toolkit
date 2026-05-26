import { PaginationConfig, PaginationQueryInput } from "./pagination.types";

function buildSearchWhere(
	searchTerm: string | undefined,
	searchFields?: string[],
) {
	if (
		!searchTerm ||
		!searchTerm.trim() ||
		!searchFields ||
		searchFields.length === 0
	) {
		return undefined;
	}

	const term = searchTerm.trim();

	const orConditions = searchFields.map((field) => ({
		[field]: {
			contains: term,
			mode: "insensitive" as const,
		},
	}));

	return orConditions;
}

function buildDateWhere(
	dateAttr: string | undefined,
	from?: string | Date,
	to?: string | Date,
) {
	if (!dateAttr || (!from && !to)) return undefined;

	const cond: Record<string, any> = {};

	if (from) cond.gte = new Date(from).toISOString();
	if (to) cond.lte = new Date(to).toISOString();

	return { [dateAttr]: cond };
}

/**
 * Build the Prisma "where" clause from query + config.
 */
export function buildWhere(
	query: PaginationQueryInput,
	config: PaginationConfig,
): Record<string, any> {
	const where: Record<string, any> = {};

	// Base filters (tenant, soft delete, etc.)
	if (config.baseWhere) {
		Object.assign(where, config.baseWhere);
	}

	// Global search (OR)
	const searchOr = buildSearchWhere(query.search, config.search);
	if (searchOr && searchOr.length > 0) {
		// If baseWhere already has an OR, you may want to merge; for now, we just overwrite.
		where.OR = searchOr;
	}

	// Date range
	const dateWhere = buildDateWhere(config.dateAttr, query.from, query.to);
	if (dateWhere) {
		Object.assign(where, dateWhere);
	}

	return where;
}
