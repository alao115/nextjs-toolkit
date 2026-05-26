import { Global, Module } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";

/**
 * Provides {@link RequestContextService} globally. Other observability /
 * tenancy / audit / feature-flag modules import this so consumers can wire
 * any one of them (e.g. just `LoggerModule`) and get a working
 * `RequestContextService` without registering it themselves.
 *
 * `@Global()` means the service is available everywhere once any module
 * in the app tree imports ContextModule — typically transitively via
 * `LoggerModule` / `TracingModule` / `MetricsModule`.
 */
@Global()
@Module({
	providers: [RequestContextService],
	exports: [RequestContextService],
})
export class ContextModule {}
