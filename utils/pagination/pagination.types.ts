export enum TogglePaginationEnum {
	ENABLE = "enable",
	DISABLE = "disable",
}

export interface PaginationQueryInput {
	page?: number;
	limit?: number;

	from?: string | Date;
	to?: string | Date;

	/**
	 * Global search term applied on configured fields.
	 */
	search?: string;

	/**
	 * Optional orderBy string syntax:
	 *   "fullname:asc,createdAt:desc"
	 * Overrides config.orderBy if present.
	 */
	sort?: string;

	enablePagination?: TogglePaginationEnum;
}

export type OrderDirection = "asc" | "desc";
export type OrderByInput = Record<string, OrderDirection>;

export interface PaginationConfig {
	/**
	 * Date attribute name for range filters.
	 * Example: "at", "createdAt", "timestamp".
	 */
	dateAttr?: string;

	/**
	 * Dotted include paths: ["post", "user.agent.auth"]
	 */
	includes?: string[];

	/**
	 * Fields used for global search: ["fullname", "reference"]
	 */
	search?: string[];

	/**
	 * Default orderBy if query.sort is not provided.
	 */
	orderBy?: OrderByInput;

	/**
	 * Extra static filters (tenant, soft delete, etc.).
	 * This will be merged into the final where.
	 */
	baseWhere?: Record<string, any>;
}
