/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 09 — Error handling.
 *
 * Shows:
 *  - Defining domain-specific exceptions via BaseException.
 *  - How HttpExceptionFilter shapes the response (status → code mapping).
 *  - PII redaction proof.
 *  - When to throw vs. when to use catchError.
 */

import { Controller, Module, NotFoundException, Post, UseFilters } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import {
	BaseException,
	HttpExceptionFilter,
	DomainError,
} from "@alaska115/nextjs-toolkit/errors";
import { catchError } from "@alaska115/nextjs-toolkit/utils";

// ─── Wiring ───────────────────────────────────────────────────────────────

@Module({
	providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class ErrorHandlingExampleModule {}

// ─── Domain exceptions (recommended approach) ────────────────────────────

/**
 * Custom domain error. The filter preserves `code`, `httpStatus`, `details`.
 * Clients should branch on `code` — never on `message` (subject to i18n).
 */
export class EmailTakenException extends BaseException {
	constructor(email: string) {
		super(
			`Email ${email} is already in use`,
			"EMAIL_TAKEN",
			409,
			{ email },
		);
	}
}

export class InsufficientCreditsException extends BaseException {
	constructor(have: number, need: number) {
		super(
			"Not enough credits",
			"INSUFFICIENT_CREDITS",
			402,
			{ have, need },
		);
	}
}

// ─── Throwing them ────────────────────────────────────────────────────────

@Controller("/users")
export class UsersController {
	@Post()
	async create(@Body() input: { email: string }) {
		const existing = await this.users.findByEmail(input.email);
		if (existing) {
			throw new EmailTakenException(input.email);
			// Response: 409 {
			//   status: 409,
			//   code: "EMAIL_TAKEN",
			//   message: "Email a@b.com is already in use",
			//   details: { email: "a@b.com" },
			//   correlationId: "..."
			// }
		}
		return this.users.create(input);
	}

	declare users: any;
	declare Body: any;
}

// ─── catchError for expected branches ────────────────────────────────────

/**
 * Use Go-style tuple for branches that are EXPECTED business logic.
 * Don't use it to swallow unexpected errors — let them bubble.
 */
@Controller("/lookup")
export class LookupController {
	declare repo: any;

	@Post()
	async lookup(@Body() input: { id: string }) {
		// Expected branch: "id might not exist." Use catchError.
		const [err, user] = await catchError(this.repo.findById(input.id));
		if (err) {
			throw new DomainError("USER_NOT_FOUND", "Unknown id", 404, { id: input.id });
		}
		return user;
	}

	declare Body: any;
}

// ─── What the filter does for you ────────────────────────────────────────
//
// 1. HTTP status → code mapping (canonical, not derived from message strings):
//      400 / 422  → VALIDATION_ERROR
//      401        → UNAUTHENTICATED
//      403        → UNAUTHORIZED
//      404        → NOT_FOUND
//      409        → CONFLICT
//      5xx        → INTERNAL_ERROR
//
// 2. Auto-attached correlationId from the active RequestContext.
//    Clients log this; you grep for it in production traces.
//
// 3. PII redaction on logged request headers.
//    Before: { authorization: "Bearer secret.jwt.token", cookie: "sid=abc" }
//    After:  { authorization: "[REDACTED]", cookie: "[REDACTED]" }
//
// 4. ErrorTrackingService forwarding — every 5xx is captured by Sentry
//    (when configured) with the active correlationId as a tag.
//
// 5. NO `console.error` spam. Only structured `LoggerService.error()` so
//    log shippers can route audit-relevant errors to a separate index.
