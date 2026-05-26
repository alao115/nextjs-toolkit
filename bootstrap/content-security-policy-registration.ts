import { INestApplication } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { randomBytes } from "crypto";

export function contentSecurityPolicyRegistration(app: INestApplication) {
	app.use((req: Request, res: Response, next: NextFunction) => {
		// generate per-request nonce for inline scripts if needed
		const nonce = randomBytes(16).toString("base64");
		res.locals.cspNonce = nonce;

		const directives = [
			`default-src 'none'`,
			`base-uri 'none'`,
			`script-src 'self' 'nonce-${nonce}'`,
			`style-src 'self' 'unsafe-inline'`,
			`img-src 'self' data:`,
			`font-src 'self'`,
			`connect-src 'self'`,
			`frame-ancestors 'none'`,
			`form-action 'self'`,
		].join("; ");

		res.setHeader("Content-Security-Policy", directives);
		next();
	});
}
