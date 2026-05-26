import { format, transports } from "winston";
import { LoggerTransport } from "./logger-transport.interface";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class FileTransport implements LoggerTransport {
	@Inject(ConfigService)
	private readonly configService: ConfigService;
	constructor() {}

	getTransport() {
		return new (transports as any).DailyRotateFile({
			filename: `${this.configService.get("logging.dir")}/${this.configService.get(
				"logging.file",
			)}-%DATE%.log`,
			datePattern: "YYYY-MM-DD",
			zippedArchive: false,
			maxSize: "20m", // optional: max file size before rotation
			// maxFiles: '14d', // keep logs for 14 days
			format: format.combine(
				format.timestamp(),
				format.json(),
				format.printf(({ timestamp, level, message, stack, ...meta }) => {
					return JSON.stringify({
						timestamp,
						level,
						message,
						...(stack ? { stack } : {}),
						...meta,
					});
				}),
			),
		});
	}
}
