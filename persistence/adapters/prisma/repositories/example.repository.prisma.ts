/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
// import { Order } from "src/modules/orders/order.entity";
// import { OrderRepository } from "src/modules/orders/order.repository";

@Injectable()
export class PrismaOrderRepository {
	constructor(private readonly prisma: PrismaService) {}

	// async findById(id: string): Promise<Order | null> {
	// 	const row = await this.prisma.order.findUnique({ where: { id } });
	// 	return row ? this.toDomain(row) : null;
	// }

	// async save(order: Order): Promise<Order> {
	// 	const data = this.toPersistence(order);
	// 	const row = await this.prisma.order.upsert({
	// 		where: { id: order.id },
	// 		create: data,
	// 		update: data,
	// 	});
	// 	return this.toDomain(row);
	// }

	// async findByUser(
	// 	userId: string,
	// 	options?: { limit?: number; offset?: number },
	// ): Promise<Order[]> {
	// 	const rows = await this.prisma.order.findMany({
	// 		where: { userId },
	// 		take: options?.limit,
	// 		skip: options?.offset,
	// 		orderBy: { createdAt: "desc" },
	// 	});

	// 	return rows.map((r) => this.toDomain(r));
	// }

	// async findPendingForPaymentRetry(limit: number): Promise<Order[]> {
	// 	const rows = await this.prisma.order.findMany({
	// 		where: {
	// 			status: "PENDING_PAYMENT",
	// 			paymentRetryCount: { lt: 3 },
	// 		},
	// 		take: limit,
	// 	});

	// 	return rows.map((r) => this.toDomain(r));
	// }

	// // Mapping functions

	// private toDomain(row: any): Order {
	// 	return new Order({
	// 		id: row.id,
	// 		userId: row.userId,
	// 		amount: row.amount,
	// 		currency: row.currency,
	// 		status: row.status,
	// 		createdAt: row.createdAt,
	// 		updatedAt: row.updatedAt,
	// 		paymentRetryCount: row.paymentRetryCount,
	// 		// etc.
	// 	});
	// }

	// private toPersistence(order: Order) {
	// 	return {
	// 		id: order.id,
	// 		userId: order.userId,
	// 		amount: order.amount,
	// 		currency: order.currency,
	// 		status: order.status,
	// 		createdAt: order.createdAt,
	// 		updatedAt: order.updatedAt,
	// 	};
	// }
}
