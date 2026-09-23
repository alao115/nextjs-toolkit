import { BaseException } from "../base.exception.js";

export class AuthLockoutError extends BaseException {
	constructor(message: string) {
		super(message, "AUTH_LOCKOUT", 403);
	}
}
