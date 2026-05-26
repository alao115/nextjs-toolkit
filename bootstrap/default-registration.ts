import {
	INestApplication,
	ValidationPipe,
	VersioningType,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { json, urlencoded } from "express";

export function registerDefaults(
	app: INestApplication,
	configService: ConfigService,
) {
	const globalPrefix = configService.get<string>("http.globalPrefix") ?? "api";
	app.setGlobalPrefix(globalPrefix);

	const apiVersion = configService.get<string>("http.apiVersion") ?? "1";
	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: apiVersion,
	});

	// Body size limits (JSON, urlencoded) — tuned for API
	app.use(json({ limit: "1mb" })); // API payload limit
	app.use(urlencoded({ extended: true, limit: "1mb" }));

	// Validation / transformation
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true, // strip unknown props
			forbidNonWhitelisted: true,
			transform: true,
			transformOptions: { enableImplicitConversion: true },
		}),
	);
	// Default: health check
}
