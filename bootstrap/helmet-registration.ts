import { INestApplication } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import helmet from "helmet";

export function helmetRegistration(app: INestApplication) {
	// Helmet baseline
	app.use(
		helmet({
			referrerPolicy: {
				policy: "no-referrer", // stricter than downgrade
			},

			frameguard: {
				action: "deny", // or "sameorigin" if needed
			},

			noSniff: true,

			hsts: {
				maxAge: 15552000,
				includeSubDomains: true,
			},

			dnsPrefetchControl: {
				allow: false,
			},

			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					scriptSrc: ["'self'"],
					objectSrc: ["'none'"],
				},
			},

			crossOriginOpenerPolicy: {
				policy: "same-origin",
			},

			crossOriginResourcePolicy: {
				policy: "same-origin",
			},

			permittedCrossDomainPolicies: {
				permittedPolicies: "none",
			},

			xssFilter: false, // important (see below)
		})
	);

	// Add more secure headers explicitly
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.setHeader("Origin-Agent-Cluster", "?1");
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");
		res.setHeader("Surrogate-Control", "no-store");
		res.setHeader(
			"Permissions-Policy",
			"geolocation=(self), microphone=(), camera=(), fullscreen=(self), payment=()"
		);
		next();
	});
}
