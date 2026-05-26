import { BaseException } from "../base.exception";

export class InvalidRefreshTokenError extends BaseException {
	constructor(message: string) {
		super(message, "INVALID_REFRESH_TOKEN", 401);
	}
}
