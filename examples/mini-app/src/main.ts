import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import {
	corsRegistration,
	helmetRegistration,
} from "@alaska115/nextjs-toolkit/bootstrap";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { bufferLogs: false });
	const config = app.get(ConfigService);

	app.setGlobalPrefix("api");

	corsRegistration(app, config);
	helmetRegistration(app);

	const port = config.get<number>("http.port") ?? 3001;
	await app.listen(port);

	// eslint-disable-next-line no-console
	console.log(`mini-app listening on http://localhost:${port}/api`);
	console.log(`try:`);
	console.log(`  curl http://localhost:${port}/api/hello`);
	console.log(
		`  curl -H "x-tenant-id: acme" http://localhost:${port}/api/tenant`,
	);
	console.log(`  curl http://localhost:${port}/api/flag/new-checkout`);
	console.log(`  curl -i http://localhost:${port}/api/error`);
	console.log(`  curl http://localhost:${port}/api/slow`);
	console.log(`  curl http://localhost:${port}/api/health/live`);
}
bootstrap();
