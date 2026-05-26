import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { LoggerService } from "./logger.service";
import { Request } from "express";

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
	constructor(private readonly logger: LoggerService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const startedAt = Date.now();
		const http = context.switchToHttp();
		const req = http.getRequest<Request>();

		const method = req.method;
		const url = (req as any).originalUrl || (req as any).url;
		const ip = req.ip || req.socket?.remoteAddress;

		this.logger.info(`Incoming ${method} ${url}`, {
			type: "http_request_start",
			method,
			url,
			ip,
		});

		return next.handle().pipe(
			tap({
				next: () => {
					const res = http.getResponse<Response>();
					const statusCode = (res as any).statusCode;
					const duration = Date.now() - startedAt;

					this.logger.info(`Handled ${method} ${url}`, {
						type: "http_request_end",
						method,
						url,
						statusCode,
						durationMs: duration,
					});
				},
				error: (err) => {
					const duration = Date.now() - startedAt;

					this.logger.error(`Error during ${method} ${url}`, {
						type: "http_request_error",
						method,
						url,
						durationMs: duration,
						errorName: err?.name,
						message: err?.message,
						...(err?.stack ? { stack: err?.stack } : {}),
					});
				},
			}),
		);
	}
}
