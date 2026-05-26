import { BaseException } from "./base.exception";

export class SecretKeyNotFoundException extends BaseException {
	constructor(key: string) {
		super(
			`Secret key ${key} not found`,
			"SECRET_KEY_NOT_FOUND",
			404,
			{ key },
			true,
		);
	}
}
