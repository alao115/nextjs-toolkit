import { PaginationQueryInput, PaginationConfig } from "./pagination.types";
import { buildInclude } from "./include.builder";
import { buildWhere } from "./where.builder";
import { buildOrderBy } from "./orderBy.builder";

export interface PrismaPaginationArgs {
	where: Record<string, any>;
	take: number;
	skip: number;
	limit?: number;
	offset?: number;
	orderBy?: any;
	include?: any;
}

export function buildPaginationQueryArgs(
	query: PaginationQueryInput,
	config: PaginationConfig,
): PrismaPaginationArgs {
	const page = query.page && query.page > 0 ? query.page : 1;
	const limit = query.limit && query.limit > 0 ? query.limit : 10;

	const skip = (page - 1) * limit;
	const take = limit;

	const where = buildWhere(query, config);
	const orderBy = buildOrderBy(query, config);
	const include = buildInclude(config.includes);

	const args: PrismaPaginationArgs = {
		where,
		take,
		skip,
		limit,
		offset: skip,
	};

	if (orderBy) args.orderBy = orderBy;
	if (include) args.include = include;

	return args;
}

export interface PaginatedResult<T> {
	items: T[];
	meta: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

export function buildPaginatedResult<T>({
	items,
	total,
	page,
	limit,
}: {
	items: T[];
	total: number;
	page: number;
	limit: number;
}): PaginatedResult<T> {
	const totalPages = Math.ceil(total / limit) || 1;
	return {
		items,
		meta: {
			page,
			limit,
			totalItems: total,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
}
