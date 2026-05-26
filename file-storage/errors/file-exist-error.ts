import { BaseException } from "../../errors/base.exception";

export class FileExistError extends BaseException {
	constructor(message: string) {
		super(message, "FILE_EXIST", 400);
	}
}
