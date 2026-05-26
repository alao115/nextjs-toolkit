import { DateTime } from "luxon";
import * as winston from "winston";
import { LoggerTransport } from "./logger-transport.interface";

export class ConsoleTransport implements LoggerTransport {
	getTransport() {
		return new winston.transports.Console({
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.colorize(),
				winston.format.printf(
					({ timestamp, level, message, stack, ...meta }) => {
						const { app, ...rest } = meta;
						return `[${app}] - ${process.pid} - ${DateTime.fromISO(timestamp as any).toFormat("dd/MM/yyyy hh:mm:ss")} - ${level} - ${message} ${stack ? JSON.stringify(stack) : ""} ${Object.keys(rest).length ? JSON.stringify(rest) : ""}`;
					},
				),
			),
		});
	}
}
