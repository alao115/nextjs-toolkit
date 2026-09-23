import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "./logger.service.js";
import type { LoggingContract } from "./logging.contract.js";
import { ShutdownManager } from "../../shutdown/shutdown.manager.js";
import { ContextModule } from "../../context/context.module.js";
import { ErrorTrackingModule } from "../error-tracker/error-tracker.module.js";

export const LOGGING_PORT = Symbol.for("@alaska115/nextjs-toolkit:LOGGING_PORT");

const loggingPortProvider: Provider = {
	provide: LOGGING_PORT,
	inject: [ConfigService, ShutdownManager],
	useFactory: (
		configService: ConfigService,
		shutdownManager: ShutdownManager,
	): LoggingContract => {
		const provider = configService.get<string>("observability.loggingProvider");

		if (provider === "winston") {
			const {
				WinstonLoggingAdapter,
			} = require("./adapters/winston-logging.adapter.js");
			return new WinstonLoggingAdapter(configService, shutdownManager);
		}

		const {
			DefaultConsoleLoggingAdapter,
		} = require("./adapters/default-logging.adapter.js");
		return new DefaultConsoleLoggingAdapter();
	},
};

@Global()
@Module({
	imports: [ContextModule, ErrorTrackingModule],
	providers: [LoggerService, loggingPortProvider],
	exports: [LoggerService],
})
export class LoggerModule {}
