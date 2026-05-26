import * as fs from "fs";
import * as path from "path";
import { NotificationTemplateNotFoundError } from "../errors/notification-template-not-found.error";
import {
	INotificationTemplateEngine,
	TemplateDefinition,
	TemplateEngineOptions,
} from "../notification.types";

export class DefaultNotificationTemplateEngine implements INotificationTemplateEngine {
	private templates = new Map<string, TemplateDefinition>();

	constructor(options: TemplateEngineOptions = {}) {
		const templatesDir =
			options.templatesDir ??
			path.join(process.cwd(), "src", "templates", "notifications");

		if (options.preload?.length) {
			for (const def of options.preload) {
				this.templates.set(def.key, def);
			}
		}

		if (fs.existsSync(templatesDir)) {
			const files = fs.readdirSync(templatesDir);
			for (const file of files) {
				if (!file.endsWith(".json")) continue;
				const fullPath = path.join(templatesDir, file);
				try {
					const raw = fs.readFileSync(fullPath, "utf8");
					const def: TemplateDefinition = JSON.parse(raw);
					if (!def.key || !def.body) {
						// eslint-disable-next-line no-console
						console.warn(`Invalid template file skipped: ${fullPath}`);
						continue;
					}
					this.templates.set(def.key, def);
				} catch (err) {
					// eslint-disable-next-line no-console
					console.error(`Failed to load template ${fullPath}`, err);
				}
			}
		}
	}

	getTemplate(key: string): TemplateDefinition {
		const tpl = this.templates.get(key);
		if (!tpl) {
			throw new NotificationTemplateNotFoundError(key);
		}
		return tpl;
	}

	renderBody(body: string, context: Record<string, any>): string {
		return body.replace(/{{\s*([\w.]+)\s*}}/g, (_match, varName) => {
			const value = varName
				.split(".")
				.reduce(
					(acc: { [x: string]: any }, k: string | number) =>
						acc ? acc[k] : undefined,
					context,
				);
			return value !== undefined && value !== null ? String(value) : "";
		});
	}

	renderSubject(
		subject: string | undefined,
		context: Record<string, any>,
	): string | undefined {
		if (!subject) return undefined;
		return this.renderBody(subject, context);
	}

	render(
		templateKey: string,
		context: Record<string, any>,
	): { subject?: string; body: string } {
		const tpl = this.getTemplate(templateKey);
		const subject = this.renderSubject(tpl.subject, context);
		const body = this.renderBody(tpl.body, context);
		return { subject, body };
	}
}
