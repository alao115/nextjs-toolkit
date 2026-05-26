import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as ngrok from "@ngrok/ngrok";

@Module({})
export class SetupNgrokProxyModule {
	static setup(config: ConfigService) {
		const appEnv = config.get("app.env");
		if (appEnv === "production") {
			return;
		}
		const ngrokEnabled = config.get("ngrok.enabled");
		if (!ngrokEnabled) {
			return;
		}

		ngrok
			.connect({
				addr: config.get("http.port"),
				authtoken: config.get("ngrok.token"),
				domain: config.get("ngrok.domain"),
			})
			.then((listener) =>
				console.log(`Ingress established at: ${listener.url()}`),
			)
			.catch((err) => console.error("ngrok proxy failed to start:", err));
	}
}
