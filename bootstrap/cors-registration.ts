import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export function corsRegistration(app: INestApplication, config: ConfigService) {
	const isCorsEnabled = config.get<boolean>("cors.enabled");
	if (!isCorsEnabled) return;

	app.enableCors({
		origin: config.get<string>("cors.origin"),
		methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		exposedHeaders: "X-Request-ID",
		credentials: true,
	});
}
