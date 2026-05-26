import { BaseException } from "../base.exception";

export class EmailTakenError extends BaseException {
	constructor(email: string) {
		super(`Email '${email}' is already taken`, "EMAIL_TAKEN", 400);
	}
}
