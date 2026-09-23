import { Module, DynamicModule, Provider, Type } from "@nestjs/common";
import { AUDIT_LOG_PORT, AuditLogContract } from "./audit.contract.js";
import { AuditLogService } from "./audit-log.service.js";
import { ActorResolver } from "./actor-resolver.js";
import { DefaultAuditLogAdapter } from "./default-audit-log.adapter.js";

export interface AuditModuleOptions {
	/** Custom adapter class to bind to {@link AUDIT_LOG_PORT}. */
	adapter?: Type<AuditLogContract>;
}

@Module({})
export class AuditModule {
	static forRoot(options: AuditModuleOptions = {}): DynamicModule {
		const adapter = options.adapter ?? DefaultAuditLogAdapter;
		const portProvider: Provider = {
			provide: AUDIT_LOG_PORT,
			useExisting: adapter,
		};
		return {
			module: AuditModule,
			providers: [adapter, portProvider, ActorResolver, AuditLogService],
			exports: [AuditLogService, ActorResolver],
		};
	}
}
