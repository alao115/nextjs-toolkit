import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextService {
	private readonly als = new AsyncLocalStorage<RequestContext>();

	runWithContext<T>(ctx: RequestContext, fn: () => T): T {
		return this.als.run(ctx, fn);
	}

	getContext(): RequestContext | undefined {
		return this.als.getStore();
	}
}
