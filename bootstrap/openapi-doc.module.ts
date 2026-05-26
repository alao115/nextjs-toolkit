import { Module, INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export enum ApiVersions {
	V1 = "v1",
	V2 = "v2",
}

@Module({})
export class OpenApiModule {
	static setup(app: INestApplication) {
		this.registerVersion(app, ApiVersions.V1, "API Version 1");
		this.registerVersion(app, ApiVersions.V2, "API Version 2");
	}

	private static registerVersion(
		app: INestApplication,
		version: ApiVersions,
		description: string,
	) {
		const config = new DocumentBuilder()
			.setTitle("Enterprise API")
			.setDescription(description)
			.setVersion(version)
			.addBearerAuth()
			.addTag("health")
			.addTag("auth")
			.addTag("users")
			.build();

		const document = SwaggerModule.createDocument(app, config, {
			include: [], // Auto-detect in full app
			deepScanRoutes: true,
		});

		SwaggerModule.setup(`/docs/${version}`, app, document);
		// if (configService.get("generateAPIDocs")) {
		// writeFileSync("./swagger.json", JSON.stringify(doc, null, 2));
		// }
	}
}
