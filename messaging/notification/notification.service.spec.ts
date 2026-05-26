import { register } from "prom-client";
import { NotificationService, IdempotencyStore } from "./notification.service";
import {
	INotificationTemplateEngine,
	NotificationMessage,
	NotificationProvider,
	NotificationResult,
} from "./notification.types";

// NotificationService registers its counter/histogram in prom-client's global
// registry on construction. Re-registering the same name throws, so each test
// needs a fresh registry.
beforeEach(() => register.clear());

class InMemoryIdempotencyStore implements IdempotencyStore {
	private store = new Map<string, NotificationResult>();
	async get(k: string) {
		return this.store.get(k) ?? null;
	}
	async set(k: string, r: NotificationResult) {
		this.store.set(k, r);
	}
}

function makeProvider(
	name: string,
	channel: NotificationMessage["channel"],
	sendFn: jest.Mock,
): NotificationProvider {
	return {
		name,
		supports: (c: NotificationMessage["channel"]) => c === channel,
		send: sendFn,
		checkHealth: async () => true,
	} as any;
}

function makeTracer() {
	const span = {
		end: jest.fn(),
		setAttribute: jest.fn(),
		setAttributes: jest.fn(),
		recordException: jest.fn(),
	};
	return {
		runInSpan: jest.fn(async (_n: string, fn: any) => fn(span)),
		startSpan: jest.fn(() => span),
	} as any;
}

function makeLogger() {
	return {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} as any;
}

function makeTemplateEngine(): INotificationTemplateEngine {
	return {
		render: jest.fn(() => ({ body: "hi", subject: "subj" })),
	} as any;
}

const baseMessage: NotificationMessage = {
	to: "x@example.com",
	channel: "email",
	templateKey: "welcome",
	context: {},
};

describe("NotificationService", () => {
	describe("idempotency", () => {
		it("returns the cached result on idempotency hit (no provider call)", async () => {
			const send = jest
				.fn()
				.mockResolvedValue({ success: true, provider: "p", messageId: "m1" });
			const provider = makeProvider("p", "email", send);
			const store = new InMemoryIdempotencyStore();
			await store.set("key-1", {
				success: true,
				provider: "p",
				messageId: "cached",
			});

			const svc = new NotificationService(
				makeTracer(),
				makeLogger(),
				makeTemplateEngine(),
				[provider],
				store,
			);
			const result = await svc.send({ ...baseMessage, idempotencyKey: "key-1" });
			expect(result.messageId).toBe("cached");
			expect(send).not.toHaveBeenCalled();
		});

		it("stores the result after first successful send", async () => {
			const send = jest
				.fn()
				.mockResolvedValue({ success: true, provider: "p", messageId: "m1" });
			const provider = makeProvider("p", "email", send);
			const store = new InMemoryIdempotencyStore();

			const svc = new NotificationService(
				makeTracer(),
				makeLogger(),
				makeTemplateEngine(),
				[provider],
				store,
			);
			await svc.send({ ...baseMessage, idempotencyKey: "key-2" });

			const stored = await store.get("key-2");
			expect(stored?.success).toBe(true);
			expect(send).toHaveBeenCalledTimes(1);
		});
	});

	describe("retry on transient failure", () => {
		it("retries up to maxRetries on non-success results", async () => {
			const send = jest
				.fn()
				.mockResolvedValueOnce({
					success: false,
					provider: "p",
					errorCode: "TRANSIENT",
					errorMessage: "x",
				})
				.mockResolvedValueOnce({
					success: false,
					provider: "p",
					errorCode: "TRANSIENT",
					errorMessage: "x",
				})
				.mockResolvedValueOnce({
					success: true,
					provider: "p",
					messageId: "m1",
				});
			const provider = makeProvider("p", "email", send);

			const svc = new NotificationService(
				makeTracer(),
				makeLogger(),
				makeTemplateEngine(),
				[provider],
			);
			const result = await svc.send(baseMessage, {
				maxRetries: 3,
				baseBackoffMs: 1,
				maxBackoffMs: 5,
				jitterMs: 0,
			});
			expect(result.success).toBe(true);
			expect(send).toHaveBeenCalledTimes(3);
		});

		it("returns the last (failed) result after maxRetries exhausted", async () => {
			const send = jest.fn().mockResolvedValue({
				success: false,
				provider: "p",
				errorCode: "TRANSIENT",
				errorMessage: "down",
			});
			const provider = makeProvider("p", "email", send);

			const svc = new NotificationService(
				makeTracer(),
				makeLogger(),
				makeTemplateEngine(),
				[provider],
			);
			const result = await svc.send(baseMessage, {
				maxRetries: 2,
				baseBackoffMs: 1,
				maxBackoffMs: 5,
				jitterMs: 0,
			});
			expect(result.success).toBe(false);
			expect(result.errorCode).toBe("TRANSIENT");
			expect(send).toHaveBeenCalledTimes(3);
		});
	});

	describe("provider selection", () => {
		it("throws when no provider supports the channel", async () => {
			const provider = makeProvider("p", "sms", jest.fn());
			const svc = new NotificationService(
				makeTracer(),
				makeLogger(),
				makeTemplateEngine(),
				[provider],
			);
			await expect(svc.send(baseMessage)).rejects.toThrow(
				/No notification provider registered for channel: email/,
			);
		});
	});
});
