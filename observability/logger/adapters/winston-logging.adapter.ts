import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as winston from "winston";
import { LogContext, LoggingContract, LogLevel } from "../logging.contract";
import { ConfigService } from "@nestjs/config";
import { ConsoleTransport } from "../transports/console.transport";
import { FileTransport } from "../transports/file.transport";
import { ShutdownManager } from "../../../shutdown/shutdown.manager";

@Injectable()
export class WinstonLoggingAdapter
	implements LoggingContract, OnModuleDestroy, OnModuleInit
{
	private logger: winston.Logger;

	constructor(
		private readonly configService: ConfigService,
		private readonly shutdownManager: ShutdownManager,
	) {
		this.logger = winston.createLogger({
			level: this.configService.get<string>("logging.level") ?? "info",
			defaultMeta: { app: this.configService.get<string>("app.name") ?? "app" },
			exitOnError: false,
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
			transports: this.configService.get<boolean>("app.includeFileTransport")
				? [
						new ConsoleTransport().getTransport(),
						new FileTransport().getTransport(),
					]
				: [new ConsoleTransport().getTransport()],
		});
	}

	onModuleInit() {
		this.shutdownManager.registerHook({
			name: "logger-flush",
			phase: "logging",
			order: 20,
			shutdown: async () => {},
		});
	}

	log(level: LogLevel, message: string, meta?: LogContext): void {
		const map: Record<LogLevel, string> = {
			fatal: "error",
			error: "error",
			warn: "warn",
			info: "info",
			debug: "debug",
			trace: "silly",
		};

		const winstonLevel = map[level] ?? "info";

		const payload = { ...(meta || {}) };

		this.logger.log(winstonLevel, message, payload);
	}

	onModuleDestroy() {
		// flush transports if needed
		for (const transport of this.logger.transports) {
			if ((transport as any).flush) {
				try {
					(transport as any).flush();
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
				} catch (_) {}
			}
		}
	}
}
