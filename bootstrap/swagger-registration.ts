import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "node:fs";

export function registerSwagger(
	app: INestApplication,
	configService: ConfigService,
) {

	if (!configService.get("swagger.enabled")) return;

	const globalPrefix = configService.get<string>("http.globalPrefix") ?? "api";
	const config = new DocumentBuilder()
		.setTitle(configService.get<string>("swagger.title") ?? "API")
		.setDescription(configService.get<string>("swagger.description") ?? "")
		.setVersion(configService.get<string>("swagger.version") ?? "1.0")
		.addBearerAuth()
		.addGlobalParameters({
			name: "X-Session-Id",
			in: "header",
			description: "Session ID",
			required: false,
			schema: {
				type: "string",
			},
		})
		.addServer(configService.get<string>("swagger.server") ?? "/")
		.build();

	const doc = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup(globalPrefix + "/docs", app, doc);

	if (configService.get("app.generateAPIDocs")) {
		const outputPath =
			configService.get<string>("swagger.outputPath") ?? "./swagger.json";
		writeFileSync(outputPath, JSON.stringify(doc, null, 2));
	}
}
