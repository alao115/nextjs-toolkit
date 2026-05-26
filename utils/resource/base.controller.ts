import {
	Get,
	Post,
	Patch,
	Delete,
	Param,
	Body,
	Query,
	HttpCode,
	HttpStatus,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { buildPaginatedResult } from "../pagination/pagination.helper";
import { PaginationQueryDto } from "../pagination";

// A generic interface your service can implement
export interface CrudService<TCreate, TUpdate, TEntity, TListFilters> {
	create(data: TCreate): Promise<TEntity>;
	findById(id: string): Promise<TEntity | null>;
	update(id: string, data: TUpdate): Promise<TEntity>;
	delete(id: string): Promise<void>;
	findPaginated(
		filters: TListFilters & { page: number; limit: number },
	): Promise<{ items: TEntity[]; total: number }>;
}

@ApiBearerAuth()
export abstract class BaseCrudController<
	TCreateDto,
	TUpdateDto,
	TEntity,
	TListFilters extends PaginationQueryDto,
> {
	constructor(
		protected readonly service: CrudService<
			TCreateDto,
			TUpdateDto,
			TEntity,
			TListFilters
		>,
	) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Create resource" })
	async create(@Body() body: TCreateDto): Promise<TEntity> {
		return this.service.create(body);
	}

	@Get(":id")
	@ApiOperation({ summary: "Get resource by id" })
	async findOne(@Param("id") id: string): Promise<TEntity> {
		const entity = await this.service.findById(id);
		// in real app use NotFoundException if null
		return entity as TEntity;
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update resource by id" })
	async update(
		@Param("id") id: string,
		@Body() body: TUpdateDto,
	): Promise<TEntity> {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Delete resource by id" })
	async remove(@Param("id") id: string): Promise<void> {
		return this.service.delete(id);
	}

	@Get()
	@ApiOperation({ summary: "List resources (paginated)" })
	async findPaginated(@Query() query: TListFilters) {
		const { page = 1, limit = 20 } = query as any;
		const { items, total } = await this.service.findPaginated({
			...(query as any),
			page,
			limit,
		});
		return buildPaginatedResult({ items, total, page, limit });
	}
}
