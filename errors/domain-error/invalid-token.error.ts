import { BaseException } from "../base.exception.js";

export class InvalidTokenError extends BaseException {
	constructor(message: string) {
		super(message, "INVALID_TOKEN", 401);
	}
}
