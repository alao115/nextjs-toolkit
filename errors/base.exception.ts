export class BaseException extends Error {
	public readonly code: string;
	public readonly httpStatus?: number;
	public readonly details?: any;
	public readonly retryable: boolean;

	constructor(
		message: string,
		code: string,
		httpStatus?: number,
		details?: any,
		retryable: boolean = false,
	) {
		super(message);
		this.code = code;
		this.httpStatus = httpStatus;
		this.details = details;
		this.retryable = retryable;
	}
}
