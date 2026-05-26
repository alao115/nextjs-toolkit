import { Module, Global } from "@nestjs/common";
import { ShutdownManager } from "./shutdown.manager";

@Global()
@Module({
	providers: [ShutdownManager],
	exports: [ShutdownManager],
})
export class ShutdownModule {}
