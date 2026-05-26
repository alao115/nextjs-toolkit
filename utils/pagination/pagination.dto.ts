import { Type } from "class-transformer";
import {
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryInput, TogglePaginationEnum } from "./pagination.types";

export class PaginationQueryDto implements PaginationQueryInput {
	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@IsOptional()
	page?: number = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@IsOptional()
	limit?: number = 20;

	@ApiPropertyOptional({
		description: "Optional search keyword",
		example: "test",
	})
	@IsString()
	@IsOptional()
	search?: string;

	@ApiPropertyOptional({
		description: "Optional sort field",
		example: "fullname:asc,createdAt:desc",
	})
	@IsOptional()
	sort?: string;

	@ApiPropertyOptional({
		description: "Optional from date",
		example: "2022-01-01",
	})
	@IsOptional()
	@IsDate()
	from?: Date;

	@ApiPropertyOptional({
		description: "Optional to date",
		example: "2022-01-01",
	})
	@IsOptional()
	@IsDate()
	to?: Date;

	@ApiPropertyOptional({
		description: "Toggle pagination feature",
		example: "enable",
		enum: TogglePaginationEnum,
	})
	@IsOptional()
	@IsEnum(TogglePaginationEnum)
	enablePagination?: TogglePaginationEnum;
}
