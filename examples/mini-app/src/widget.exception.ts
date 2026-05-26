import { BaseException } from "@alaska115/nextjs-toolkit/errors";

/**
 * Demo domain exception. The package's HttpExceptionFilter preserves
 * `code`, `httpStatus`, and `details` verbatim in the response.
 */
export class WidgetMissingException extends BaseException {
	constructor(id: string) {
		super(
			`Widget ${id} not found`,
			"WIDGET_NOT_FOUND",
			404,
			{ widgetId: id },
		);
	}
}
