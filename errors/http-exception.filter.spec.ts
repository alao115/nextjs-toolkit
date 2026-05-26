import {
	ArgumentsHost,
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { BaseException } from "./base.exception";

function makeHost(req: Partial<{
	headers: Record<string, any>;
	url: string;
	method: string;
	ip: string;
	socket: { remoteAddress?: string };
}> = {}, res: { status: jest.Mock; json: jest.Mock } = makeRes()): ArgumentsHost {
	return {
		switchToHttp: () => ({
			getRequest: () => ({
				headers: req.headers ?? {},
				url: req.url ?? "/",
				method: req.method ?? "GET",
				ip: req.ip,
				socket: req.socket ?? {},
			}),
			getResponse: () => res,
		}),
	} as any;
}

function makeRes() {
	const status = jest.fn();
	const json = jest.fn();
	status.mockReturnValue({ json });
	return { status, json } as any;
}

function makeFilter() {
	const errorTracking = { captureError: jest.fn() } as any;
	const ctxService = { getContext: jest.fn().mockReturnValue(undefined) } as any;
	const logger = { error: jest.fn() } as any;
	const filter = new HttpExceptionFilter(errorTracking, ctxService, logger);
	return { filter, errorTracking, ctxService, logger };
}

describe("HttpExceptionFilter", () => {
	describe("status → code mapping", () => {
		const cases: Array<[HttpException, string, number]> = [
			[new BadRequestException(), "VALIDATION_ERROR", 400],
			[new UnauthorizedException(), "UNAUTHENTICATED", 401],
			[new ForbiddenException(), "UNAUTHORIZED", 403],
			[new NotFoundException(), "NOT_FOUND", 404],
		];
		it.each(cases)(
			"%p maps to code=%s status=%i",
			(exception, expectedCode, expectedStatus) => {
				const { filter } = makeFilter();
				const res = makeRes();
				filter.catch(exception, makeHost({}, res));
				expect(res.status).toHaveBeenCalledWith(expectedStatus);
				expect(res.json).toHaveBeenCalledWith(
					expect.objectContaining({ status: expectedStatus, code: expectedCode }),
				);
			},
		);

		it("falls back to INTERNAL_ERROR for unknown exceptions", () => {
			const { filter } = makeFilter();
			const res = makeRes();
			filter.catch(new Error("boom"), makeHost({}, res));
			expect(res.status).toHaveBeenCalledWith(500);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ code: "INTERNAL_ERROR" }),
			);
		});
	});

	describe("BaseException handling", () => {
		class MyDomainError extends BaseException {
			constructor() {
				super("Forbidden flow", "FORBIDDEN_FLOW", 403, { foo: "bar" });
			}
		}
		it("preserves the BaseException's code, status, and details", () => {
			const { filter } = makeFilter();
			const res = makeRes();
			filter.catch(new MyDomainError(), makeHost({}, res));
			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					code: "FORBIDDEN_FLOW",
					message: "Forbidden flow",
					details: { foo: "bar" },
				}),
			);
		});
	});

	describe("PII redaction", () => {
		it("redacts Authorization and Cookie headers before logging", () => {
			const { filter, logger } = makeFilter();
			const headers = {
				authorization: "Bearer secret.jwt.token",
				cookie: "sid=abc",
				accept: "application/json",
			};
			filter.catch(new BadRequestException("nope"), makeHost({ headers }));
			const loggedMeta = logger.error.mock.calls[0][1];
			expect(loggedMeta.headers.authorization).toBe("[REDACTED]");
			expect(loggedMeta.headers.cookie).toBe("[REDACTED]");
			expect(loggedMeta.headers.accept).toBe("application/json");
		});
	});

	describe("requestId derivation", () => {
		it("prefers x-kong-request-id", () => {
			const { filter } = makeFilter();
			const res = makeRes();
			filter.catch(
				new BadRequestException(),
				makeHost({ headers: { "x-kong-request-id": "kong-123" } }, res),
			);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ correlationId: "kong-123" }),
			);
		});

		it("falls back to x-request-id", () => {
			const { filter } = makeFilter();
			const res = makeRes();
			filter.catch(
				new BadRequestException(),
				makeHost({ headers: { "x-request-id": "req-456" } }, res),
			);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ correlationId: "req-456" }),
			);
		});

		it("generates a UUID when no header is present", () => {
			const { filter } = makeFilter();
			const res = makeRes();
			filter.catch(new BadRequestException(), makeHost({}, res));
			const body = res.json.mock.calls[0][0];
			expect(body.correlationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});
	});
});
