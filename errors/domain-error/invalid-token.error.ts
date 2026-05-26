import { BaseException } from "../base.exception";

export class InvalidTokenError extends BaseException {
	constructor(message: string) {
		super(message, "INVALID_TOKEN", 401);
	}
}
