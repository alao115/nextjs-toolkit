import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { FindOptions, PersistencePort } from "../../persistence.service";
import { v7 as uuidv7 } from "uuid";

@Injectable()
export class PrismaPersistenceAdapter implements PersistencePort {
	constructor(private readonly prisma: PrismaService) {}

	get getOrm(): PrismaService {
		return this.prisma;
	}

	async findOne<T>(options: FindOptions): Promise<T | null> {
		return (this.prisma.instance as any)[options.entity].findUnique({
			where: options.where,
			include: options.include,
			select: options.select,
		});
	}

	async findMany<T>(options: FindOptions): Promise<T[]> {
		return (this.prisma.instance as any)[options.entity].findMany({
			where: options.where,
			include: options.include,
			select: options.select,
			orderBy: options.orderBy,
			take: options.limit,
			skip: options.offset,
		});
	}

	async insert<T>(payload: { entity: string; data: any }): Promise<T> {
		return (this.prisma.instance as any)[payload.entity].create({
			data: {
				...payload.data,
				id: payload.data?.id || uuidv7(),
			},
		});
	}

	async update<T>(payload: { entity: string; data: any }): Promise<T> {
		return (this.prisma.instance as any)[payload.entity].update({
			where: { id: payload.data.id },
			data: payload.data,
		});
	}

	async delete(payload: {
		entity: string;
		where: Record<string, any>;
	}): Promise<void> {
		await (this.prisma.instance as any)[payload.entity].delete({ where: payload.where });
	}

	async transactional<T>(fn: (ctx?: any) => Promise<T>): Promise<T> {
		return this.prisma.instance.$transaction(async (tx) => fn(tx));
	}
}
