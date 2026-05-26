import { BaseException } from "../base.exception";

export class AuthLockoutError extends BaseException {
	constructor(message: string) {
		super(message, "AUTH_LOCKOUT", 403);
	}
}
