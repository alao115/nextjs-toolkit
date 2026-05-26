export interface FindOptions {
	entity: string;
	where?: Record<string, any>;
	select?: Record<string, boolean>;
	include?: Record<string, any>;
	order?: Record<string, "asc" | "desc"> | never;
	orderBy?: Record<string, "asc" | "desc">;
	limit?: number;
	offset?: number;
}

export interface PersistencePort {
	findOne<T = any>(options: FindOptions): Promise<T | null>;
	findMany<T = any>(options: FindOptions): Promise<T[]>;
	insert<T = any>(payload: { entity: string; data: any }): Promise<T>;
	update<T = any>(payload: { entity: string; data: any }): Promise<T>;
	delete(payload: {
		entity: string;
		where: Record<string, any>;
	}): Promise<void>;
	transactional<T>(fn: (ctx?: any) => Promise<T>): Promise<T>;
	getOrm: any;
}

export interface PersistenceHealthService {
	ping(): Promise<any>;
}

export interface IGenericRepository<T> {
	findById(id: string): Promise<T | null>;
	findOne(options: FindOptions): Promise<T | null>;
	findMany(options: FindOptions): Promise<T[]>;
	totalCount?: (opts?: Pick<FindOptions, "where">) => Promise<number>;
	create(entity: Partial<T>): Promise<T>;
	update(id: string, patch: Partial<T>): Promise<T>;
	delete(id: string): Promise<void>;

	toDomain(entity: any): T;
}
