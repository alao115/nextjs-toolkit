import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ErrorCode, LogicalErrorCode } from "./error.types";
import { ErrorTrackingService } from "../observability/error-tracker/error-tracking.service";
import { RequestContextService } from "../context";
import { BaseException } from "./base.exception";
import { LoggerService, redact } from "../observability/logger";

function statusToLogicalCode(status: number): LogicalErrorCode {
	switch (status) {
		case HttpStatus.BAD_REQUEST:
		case HttpStatus.UNPROCESSABLE_ENTITY:
			return "VALIDATION_ERROR";
		case HttpStatus.UNAUTHORIZED:
			return "UNAUTHENTICATED";
		case HttpStatus.FORBIDDEN:
			return "UNAUTHORIZED";
		case HttpStatus.NOT_FOUND:
			return "NOT_FOUND";
		case HttpStatus.CONFLICT:
			return "CONFLICT";
		default:
			return "INTERNAL_ERROR";
	}
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
	constructor(
		private readonly errorTracking: ErrorTrackingService,
		private readonly ctxService: RequestContextService,
		private readonly logger: LoggerService,
	) {}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const requestId =
			(request.headers["x-kong-request-id"] as string) ||
			(request.headers["x-request-id"] as string) ||
			this.ctxService.getContext()?.requestId ||
			randomUUID();

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let code: ErrorCode = "INTERNAL_ERROR";
		let message = "Internal server error";
		let details: any = null;

		if (exception instanceof BaseException) {
			status = exception.httpStatus || status;
			code = exception.code as ErrorCode;
			message = exception.message;
			details = exception.details;
		} else if (exception instanceof HttpException) {
			status = exception.getStatus();
			message = exception.message;
			code = statusToLogicalCode(status);
			const body = exception.getResponse() as any;
			details = body && typeof body === "object" ? body.message ?? body : body;
		}

		this.logger.error("HttpException", {
			exception,
			requestId,
			headers: redact(request.headers),
			url: request.url,
			ip: request.ip || request.socket?.remoteAddress,
		});

		this.errorTracking.captureError(exception, {
			status,
			http: {
				method: request.method,
				route: request.url,
			},
		});

		response
			.status(status)
			.json({ status, code, message, details, correlationId: requestId });
	}
}
