import { BaseException } from "../../errors/base.exception";

export class FileNotFoundError extends BaseException {
	constructor(message: string = "File not found") {
		super(message, "FILE_NOT_FOUND", 400);
	}
}
