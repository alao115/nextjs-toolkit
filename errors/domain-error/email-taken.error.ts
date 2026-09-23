import { BaseException } from "../base.exception.js";

export class EmailTakenError extends BaseException {
	constructor(email: string) {
		super(`Email '${email}' is already taken`, "EMAIL_TAKEN", 400);
	}
}
