import { ConfigModule } from "@nestjs/config";
import configuration from "./configuration";
import { configValidationSchema } from "./configuration.validation";
import { Global, Module } from "@nestjs/common";
import { ConfigurationHelpersService } from "./configuration.helpers.service";

@Global()
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [configuration],
			validationSchema: configValidationSchema,
			validationOptions: {
				allowUnknown: true,
				abortEarly: false,
			},
			envFilePath: [".env", ".env.local"],
		}),
	],
	providers: [ConfigurationHelpersService],
	exports: [ConfigurationHelpersService],
})
export class ConfigurationModule {}

export * from "./configuration.helpers.service";
export * from "./configuration.validation";
