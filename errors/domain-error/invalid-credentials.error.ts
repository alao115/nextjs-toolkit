import { BaseException } from "../base.exception";

export class InvalidCredentialsError extends BaseException {
	constructor(message: string) {
		super(message, "INVALID_CREDENTIALS", 401);
	}
}
