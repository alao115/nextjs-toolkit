import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { PersistenceHealthService } from "../../persistence.service";

@Injectable()
export class PrismaHealthService implements PersistenceHealthService {
	constructor(private readonly prismaService: PrismaService) {}

	ping(): Promise<any> {
		return this.prismaService.instance.$queryRaw`SELECT 1`;
	}
}
