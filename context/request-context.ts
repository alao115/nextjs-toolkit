import { randomUUID } from "node:crypto";

export interface RequestContextValues {
	requestId: string;
	correlationId: string;
	traceId: string;
	spanId?: string;
	userId?: string;
	tenantId?: string;
	ip?: string;
	secured: boolean;
}

export class RequestContext implements RequestContextValues {
	requestId: string;
	correlationId: string;
	traceId: string;
	spanId?: string;
	userId?: string;
	tenantId?: string;
	ip?: string;
	secured: boolean;

	constructor(partial: Partial<RequestContextValues> = {}) {
		this.requestId = partial.requestId ?? randomUUID();
		this.correlationId = partial.correlationId ?? this.requestId;
		this.traceId = partial.traceId ?? this.requestId;
		this.spanId = partial.spanId;
		this.userId = partial.userId;
		this.tenantId = partial.tenantId;
		this.ip = partial.ip;
		this.secured = partial.secured ?? false;
	}
}
