import * as fs from "fs";
import * as path from "path";
import { NotificationTemplateNotFoundError } from "../errors/notification-template-not-found.error";
import {
	INotificationTemplateEngine,
	TemplateDefinition,
	TemplateEngineOptions,
} from "../notification.types";
import * as Twig from "twig";

export class TwigNotificationTemplateEngine implements INotificationTemplateEngine {
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
				if (!file.endsWith(".twig")) continue;
				const fullPath = path.join(templatesDir, file);
				const key = file.replace(".twig", "");
				try {
					const raw = fs.readFileSync(fullPath, "utf8");
					const def: TemplateDefinition = {
						key,
						channel: "email",
						subject: undefined,
						body: raw,
					};
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

	render(
		templateKey: string,
		context: Record<string, any>,
	): { subject?: string; body: string } {
		const tpl = this.getTemplate(templateKey);
		const subject = undefined;
		const body = Twig.twig({ data: tpl.body, async: true }).render(context);
		return { subject, body };
	}
}
