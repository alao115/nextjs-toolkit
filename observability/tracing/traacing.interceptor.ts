import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { TracingService } from "./tracing.service";

@Injectable()
export class TracingInterceptor implements NestInterceptor {
	constructor(private readonly tracing: TracingService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const http = context.switchToHttp();
		const req = http.getRequest<Request>();

		const method = req.method;
		const url = (req as any).originalUrl || (req as any).url;

		const span = this.tracing.startSpan(`HTTP ${method} ${url}`, {
			"http.method": method,
			"http.route": url,
		});

		const handle$ = next.handle();

		return new Observable((subscriber) => {
			const sub = handle$.subscribe({
				next: (value) => subscriber.next(value),
				error: (err) => {
					span.end(err);
					subscriber.error(err);
				},
				complete: () => {
					span.end();
					subscriber.complete();
				},
			});

			return () => sub.unsubscribe();
		});
	}
}
