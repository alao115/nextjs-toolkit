import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { randomUUID } from "node:crypto";
import { RequestContext } from "./request-context";
import { RequestContextService } from "./request-context.service";
import { Request } from "express";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
	constructor(private readonly ctxService: RequestContextService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const http = context.switchToHttp();
		const req = http.getRequest<Request>();

		const correlationId =
		(req.headers["x-kong-request-id"] as string) ||
			(req.headers["x-correlation-id"] as string) || randomUUID();

		const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();

		const traceId = (req.headers["traceparent"] as string) ?? correlationId;

		const userId = (req as any).user?.id;

		// Tenant header takes precedence; fall back to user-attached tenant.
		const tenantId =
			(req.headers["x-tenant-id"] as string) ||
			(req as any).user?.tenantId;

		const ip = req.ip || req.socket.remoteAddress;

		const ctx = new RequestContext({
			requestId,
			correlationId,
			traceId,
			userId,
			tenantId,
			ip,
			secured: req.secure,
		});

		return this.ctxService.runWithContext(ctx, () => next.handle());
	}
}
