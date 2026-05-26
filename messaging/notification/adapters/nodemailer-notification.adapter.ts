import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { NotificationPayload } from "../notification.types";
import { EmailTransport } from "../providers/email.provider";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class NodemailerEmailAdapter implements EmailTransport {
	constructor(private readonly configService: ConfigService) {}

	private transporter = nodemailer.createTransport({
		host: this.configService.get<string>("mail.host"),
		port: this.configService.get<number>("mail.port"),
		auth: {
			user: this.configService.get<string>("mail.user"),
			pass: this.configService.get<string>("mail.password"),
		},
		secure: this.configService.get<boolean>("mail.secure"),
	});

	async sendMail(payload: NotificationPayload) {
		const info = await this.transporter.sendMail({
			from: this.configService.get<string>("mail.sender"),
			to: payload.to as string,
			subject: payload.subject,
			html: payload.template, // this.renderTemplate(payload.template, payload.data),
		});
		return { messageId: info.messageId };
	}

	renderTemplate(templateName: string, data: Record<string, any>) {
		// simple template rendering (handlebars, ejs)
		return `<p>${data.content}</p>`;
	}

	async checkHealth(): Promise<boolean> {
		return await new Promise((resolve, reject) => {
			nodemailer.createTestAccount(async (err: any, account: any) => {
				if (err) {
					console.error("Failed to create a testing account. " + err.message);
					return reject(false);
				}

				console.log("Credentials obtained, sending message...");

				// Create a SMTP transporter object
				const transporter = nodemailer.createTransport({
					host: account.smtp.host,
					port: account.smtp.port,
					secure: account.smtp.secure,
					auth: {
						user: account.user,
						pass: account.pass,
					},
				});

				// Message object
				const message = {
					from: "Sender Name <sender@example.com>",
					to: "Recipient <recipient@example.com>",
					subject: "Nodemailer is unicode friendly ✔",
					text: "Hello to myself!",
					html: "<p><b>Hello</b> to myself!</p>",
				};

				const info = await transporter.sendMail(message);

				console.log("Message sent: %s", info.messageId);
				// Preview only available when sending through an Ethereal account
				console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
				return resolve(true);
			});
		});
	}
}
