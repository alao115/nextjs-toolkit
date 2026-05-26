import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import {
	RATE_LIMIT_PORT,
	RateLimitContract,
} from "./rate-limit.contract";
import { RequestContextService } from "../context";

export interface RateLimitMetadata {
	/**
	 * Cost to deduct from the bucket. Default: 1. Use for expensive endpoints.
	 */
	cost?: number;
	/**
	 * Override the key — by default the guard uses
	 * `${tenantId ?? "global"}:${userId ?? ip}:${route}`.
	 */
	key?: string | ((req: Request) => string);
	/**
	 * Skip the limiter on this handler (useful when a class-level guard is set
	 * and one method is exempt).
	 */
	skip?: boolean;
}

const RATE_LIMIT_METADATA_KEY = Symbol("RATE_LIMIT_METADATA");

/**
 * Method/class decorator: configures the {@link RateLimitGuard} for the
 * decorated route(s).
 *
 * ```ts
 * @RateLimit({ cost: 5 })  // 5x cost
 * @Post("/expensive")
 * doThing() { ... }
 * ```
 */
export const RateLimit = (meta: RateLimitMetadata = {}) =>
	SetMetadata(RATE_LIMIT_METADATA_KEY, meta);

/**
 * Pluggable rate-limit guard. Reads {@link RateLimitMetadata} from the handler
 * and class, composes a sensible default key from request context, calls the
 * configured {@link RateLimitContract}, and sets the standard
 * `X-RateLimit-*` + `Retry-After` headers.
 *
 * Wire as a global guard (`APP_GUARD`) or per-controller via `@UseGuards(RateLimitGuard)`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
	constructor(
		@Inject(RATE_LIMIT_PORT) private readonly limiter: RateLimitContract,
		private readonly reflector: Reflector,
		private readonly ctxService: RequestContextService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const http = context.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();

		const meta =
			this.reflector.get<RateLimitMetadata>(
				RATE_LIMIT_METADATA_KEY,
				context.getHandler(),
			) ??
			this.reflector.get<RateLimitMetadata>(
				RATE_LIMIT_METADATA_KEY,
				context.getClass(),
			) ??
			{};

		if (meta.skip) return true;

		const key =
			typeof meta.key === "function"
				? meta.key(req)
				: meta.key ?? this.defaultKey(req);

		const decision = await this.limiter.consume(key, meta.cost ?? 1);

		res.setHeader("X-RateLimit-Remaining", String(decision.remaining));

		if (!decision.allowed) {
			if (decision.retryAfterMs !== undefined) {
				res.setHeader(
					"Retry-After",
					String(Math.ceil(decision.retryAfterMs / 1000)),
				);
			}
			throw new HttpException(
				{ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: "Too Many Requests" },
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		return true;
	}

	private defaultKey(req: Request): string {
		const ctx = this.ctxService.getContext();
		const tenant = ctx?.tenantId ?? "global";
		const principal = ctx?.userId ?? req.ip ?? "unknown";
		const route = (req as any).route?.path ?? req.path ?? "*";
		return `${tenant}:${principal}:${route}`;
	}
}
