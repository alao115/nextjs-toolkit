import { BaseException } from "../../../errors/index.js";

export class NotificationTemplateNotFoundError extends BaseException {
	constructor(templateKey: string) {
		super(
			`Notification template not found: ${templateKey}`,
			"NOTIFICATION_TEMPLATE_NOT_FOUND",
			500,
		);
	}
}
