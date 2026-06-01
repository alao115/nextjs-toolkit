import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "node:fs";

export interface RegisterSwaggerOptions {
	/**
	 * Whether the caller wants Swagger at all. When `false`, the function is
	 * a no-op — no config is read, nothing is validated, no `/docs` route
	 * is mounted.
	 */
	enabled: boolean;
	/** The Nest application instance to mount the docs onto. */
	app: INestApplication;
	/**
	 * `ConfigService` to read `swagger.*` + `http.globalPrefix` +
	 * `app.generateAPIDocs` keys from.
	 */
	config: ConfigService;
}

/**
 * Boot-time Swagger registration.
 *
 * When `enabled: false` — no-op.
 *
 * When `enabled: true` — validates that `swagger.title` and `swagger.version`
 * are set on the {@link ConfigService}. **Throws** `Error` if either is
 * missing. The remaining fields have sensible defaults and are optional:
 *
 * - `swagger.description` — defaults to `""`
 * - `swagger.server` — defaults to `"/"`
 * - `http.globalPrefix` — defaults to `"api"`. Docs are mounted at
 *   `${globalPrefix}/docs`.
 * - `swagger.outputPath` — defaults to `"./swagger.json"`. Only written when
 *   `app.generateAPIDocs === "true"`.
 */
export function registerSwagger(options: RegisterSwaggerOptions): void {
	if (!options.enabled) return;

	const { app, config } = options;
	const title = config.get<string>("swagger.title");
	const version = config.get<string>("swagger.version");

	const missing: string[] = [];
	if (!title) missing.push("swagger.title");
	if (!version) missing.push("swagger.version");

	if (missing.length > 0) {
		throw new Error(
			`registerSwagger({ enabled: true }): missing required config keys: ${missing.join(", ")}. ` +
				"Set the corresponding env vars (SWAGGER_TITLE, SWAGGER_VERSION) or pass enabled: false.",
		);
	}

	const globalPrefix = config.get<string>("http.globalPrefix") ?? "api";
	const description = config.get<string>("swagger.description") ?? "";
	const server = config.get<string>("swagger.server") ?? "/";

	const docConfig = new DocumentBuilder()
		.setTitle(title!)
		.setDescription(description)
		.setVersion(version!)
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
		.addServer(server)
		.build();

	const doc = SwaggerModule.createDocument(app, docConfig);
	SwaggerModule.setup(globalPrefix + "/docs", app, doc);

	if (config.get("app.generateAPIDocs")) {
		const outputPath =
			config.get<string>("swagger.outputPath") ?? "./swagger.json";
		writeFileSync(outputPath, JSON.stringify(doc, null, 2));
	}
}
