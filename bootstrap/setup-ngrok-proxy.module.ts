import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as ngrok from "@ngrok/ngrok";

export interface SetupNgrokProxyOptions {
	/**
	 * Whether the caller wants ngrok at all. When `false`, the function is
	 * a no-op — no config is read, nothing is validated.
	 *
	 * Pass `false` unconditionally in production unless you genuinely want
	 * an ngrok tunnel there. The previous behavior of silently no-op'ing in
	 * `app.env === "production"` was removed in 0.5.0 — the caller owns
	 * the decision now.
	 */
	enabled: boolean;
	/** `ConfigService` to read `http.port`, `ngrok.token`, `ngrok.domain` from. */
	config: ConfigService;
}

@Module({})
export class SetupNgrokProxyModule {
	/**
	 * Boot-time ngrok tunnel setup.
	 *
	 * When `enabled: false` — no-op.
	 *
	 * When `enabled: true` — validates that `http.port`, `ngrok.token`, and
	 * `ngrok.domain` are all set on the {@link ConfigService}. **Throws**
	 * `Error` if any are missing. This fail-fast behavior replaces the
	 * previous silent no-op-on-missing-config to surface misconfiguration
	 * at boot rather than after the next ngrok-dependent request.
	 */
	static setup(options: SetupNgrokProxyOptions): void {
		if (!options.enabled) return;

		const { config } = options;
		const port = config.get<number>("http.port");
		const token = config.get<string>("ngrok.token");
		const domain = config.get<string>("ngrok.domain");

		const missing: string[] = [];
		if (port === undefined || port === null) missing.push("http.port");
		if (!token) missing.push("ngrok.token");
		if (!domain) missing.push("ngrok.domain");

		if (missing.length > 0) {
			throw new Error(
				`SetupNgrokProxyModule.setup({ enabled: true }): missing required config keys: ${missing.join(", ")}. ` +
					"Set the corresponding env vars (HTTP_PORT, NGROK_TOKEN, NGROK_DOMAIN) or pass enabled: false.",
			);
		}

		ngrok
			.connect({ addr: port, authtoken: token, domain })
			.then((listener) =>
				console.log(`Ingress established at: ${listener.url()}`),
			)
			.catch((err) => console.error("ngrok proxy failed to start:", err));
	}
}
