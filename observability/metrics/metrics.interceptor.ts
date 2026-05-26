import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
	constructor(private readonly metrics: MetricsService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const http = context.switchToHttp();
		const req = http.getRequest<any>();

		const method = req.method;
		const route = req.route?.path || req.originalUrl || req.url || "unknown";

		const start = Date.now();
		const counter = this.metrics.httpRequestCounter();
		const hist = this.metrics.httpRequestDuration();

		return next.handle().pipe(
			tap({
				next: () => {
					const res = http.getResponse<any>();
					const status = res.statusCode;

					const labels = this.metrics.withContextLabels({
						method,
						route,
						status: String(status),
					});

					counter.inc(labels);
					hist.observe(labels, Date.now() - start);
				},
				error: () => {
					const labels = this.metrics.withContextLabels({
						method,
						route,
						status: "error",
					});

					counter.inc(labels);
					hist.observe(labels, Date.now() - start);
				},
			}),
		);
	}
}
