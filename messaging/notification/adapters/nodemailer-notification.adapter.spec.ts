const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn(() => ({ sendMail, verify }));
const createTestAccount = jest.fn();

jest.mock("nodemailer", () => ({ createTransport, createTestAccount }));

import { NodemailerEmailAdapter } from "./nodemailer-notification.adapter.js";
import { ConfigService } from "@nestjs/config";

const config = (values: Record<string, unknown> = {}) =>
	({ get: (k: string) => values[k] }) as unknown as ConfigService;

function adapter(values: Record<string, unknown> = {}) {
	return new NodemailerEmailAdapter(config({ "mail.sender": "no-reply@acme.test", ...values }));
}

beforeEach(() => {
	jest.clearAllMocks();
	sendMail.mockResolvedValue({ messageId: "mid-1" });
	verify.mockResolvedValue(true);
});

describe("sendMail", () => {
	// Regression: the adapter used to read `payload.template` — the template
	// *key*, which EmailProvider never sends — so every email went out with
	// `html: undefined` and arrived empty.
	it("sends the rendered body as html", async () => {
		await adapter().sendMail({
			to: "user@acme.test",
			from: "billing@acme.test",
			subject: "Invoice",
			html: "<p>Your invoice is ready</p>",
		});

		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ html: "<p>Your invoice is ready</p>" }),
		);
	});

	it("never sends an undefined body when a payload carries one", async () => {
		await adapter().sendMail({
			to: "user@acme.test",
			subject: "s",
			html: "<p>body</p>",
		});
		expect(sendMail.mock.calls[0][0].html).toBeDefined();
	});

	it("falls back to `body` when `html` is absent", async () => {
		await adapter().sendMail({ to: "u@acme.test", subject: "s", body: "plain text" });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ html: "plain text" }),
		);
	});

	it("honours the payload's from address", async () => {
		await adapter().sendMail({ to: "u@acme.test", from: "billing@acme.test", html: "x" });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ from: "billing@acme.test" }),
		);
	});

	it("falls back to mail.sender when the payload has no from", async () => {
		await adapter().sendMail({ to: "u@acme.test", html: "x" });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ from: "no-reply@acme.test" }),
		);
	});

	it("returns the transport's messageId", async () => {
		sendMail.mockResolvedValue({ messageId: "abc-123" });
		await expect(adapter().sendMail({ to: "u@acme.test", html: "x" })).resolves.toEqual({
			messageId: "abc-123",
		});
	});

	it("propagates transport failures", async () => {
		sendMail.mockRejectedValue(new Error("ECONNREFUSED"));
		await expect(adapter().sendMail({ to: "u@acme.test", html: "x" })).rejects.toThrow(
			"ECONNREFUSED",
		);
	});
});

describe("checkHealth", () => {
	it("verifies the configured transport", async () => {
		await expect(adapter().checkHealth()).resolves.toBe(true);
		expect(verify).toHaveBeenCalledTimes(1);
	});

	// Regression: checkHealth used to run nodemailer's Ethereal sample code —
	// creating a throwaway test account and sending a hardcoded message — on
	// every health probe.
	it("sends no message and creates no test account", async () => {
		await adapter().checkHealth();
		expect(sendMail).not.toHaveBeenCalled();
		expect(createTestAccount).not.toHaveBeenCalled();
	});

	it("reports down when the transport cannot be verified", async () => {
		verify.mockRejectedValue(new Error("535 auth failed"));
		await expect(adapter().checkHealth()).resolves.toBe(false);
	});

	it("does not throw when verification fails", async () => {
		verify.mockRejectedValue(new Error("boom"));
		await expect(adapter().checkHealth()).resolves.toBe(false);
	});
});
