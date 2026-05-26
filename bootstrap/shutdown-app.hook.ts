import { INestApplication } from "@nestjs/common";
import { ShutdownManager } from "../shutdown/shutdown.manager";

export function registerShutdownAppHook(app: INestApplication) {
	const shutdownManager = app.get(ShutdownManager);

	shutdownManager.registerHook({
		name: "shutdown-app",
		phase: "stopTraffic",
		order: 10,
		shutdown: async () => {
			await app.close();
		},
	});
}
