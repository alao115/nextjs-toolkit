import { ConfigModule } from "@nestjs/config";
import configuration from "./configuration.js";
import { configValidationSchema } from "./configuration.validation.js";
import { Global, Module } from "@nestjs/common";
import { ConfigurationHelpersService } from "./configuration.helpers.service.js";

@Global()
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [configuration],
			// v12 validates through Standard Schema (Joi 18 implements it) and
			// already defaults Joi to `{ abortEarly: false, allowUnknown: true }` —
			// exactly what this used to pass via `validationOptions`, which no
			// longer accepts vendor-specific keys. Undeclared env vars are merged
			// back in by the module itself, so they stay readable via ConfigService.
			// To override: `validationOptions: { libraryOptions: { ... } }`.
			validationSchema: configValidationSchema,
			envFilePath: [".env", ".env.local"],
		}),
	],
	providers: [ConfigurationHelpersService],
	exports: [ConfigurationHelpersService],
})
export class ConfigurationModule {}

export * from "./configuration.helpers.service.js";
export * from "./configuration.validation.js";
