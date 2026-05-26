import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RequestContextService } from "./request-context.service";
import { AppResponse } from "../utils/resource";

@Injectable()
export class GlobalResponseInterceptor implements NestInterceptor {
	constructor(private readonly ctxService: RequestContextService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const correlationId =
			request.headers["x-correlation-id"] ??
			this.ctxService.getContext()?.correlationId;

		return next.handle().pipe(
			map((data) => {
				return data?.logger?.context === "StreamableFile"
					? data
					: AppResponse.success(data, correlationId);
			}),
		);
	}
}
