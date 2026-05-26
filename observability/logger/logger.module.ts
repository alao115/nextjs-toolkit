import { Global, Module, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "./logger.service";
import type { LoggingContract } from "./logging.contract";
import { ShutdownManager } from "../../shutdown/shutdown.manager";
import { ContextModule } from "../../context/context.module";
import { ErrorTrackingModule } from "../error-tracker/error-tracker.module";

export const LOGGING_PORT = Symbol("LOGGING_PORT");

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
			} = require("./adapters/winston-logging.adapter");
			return new WinstonLoggingAdapter(configService, shutdownManager);
		}

		const {
			DefaultConsoleLoggingAdapter,
		} = require("./adapters/default-logging.adapter");
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
