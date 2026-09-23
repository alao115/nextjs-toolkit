import winston from "winston";
export interface LoggerTransport {
	getTransport(): winston.transport;
}
