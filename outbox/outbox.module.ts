import { Module, DynamicModule, Provider } from "@nestjs/common";
import { OUTBOX_PORT, OutboxContract } from "./outbox.contract";
import { InMemoryOutboxAdapter } from "./in-memory-outbox.adapter";

export interface OutboxModuleOptions {
	/**
	 * Custom adapter instance. If omitted, an {@link InMemoryOutboxAdapter}
	 * is used — only suitable for tests / single-process dev.
	 */
	adapter?: OutboxContract;
}

@Module({})
export class OutboxModule {
	static forRoot(options: OutboxModuleOptions = {}): DynamicModule {
		const portProvider: Provider = {
			provide: OUTBOX_PORT,
			useValue: options.adapter ?? new InMemoryOutboxAdapter(),
		};
		return {
			module: OutboxModule,
			providers: [portProvider],
			exports: [OUTBOX_PORT],
		};
	}
}
