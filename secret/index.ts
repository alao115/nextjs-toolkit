import { Global, Module, Provider } from "@nestjs/common";
import { SecretManager, SECRET_MANAGER } from "./secret-manager.interface";
import { ConfigService } from "@nestjs/config";
import { LocalSecretManager } from "./local-secret-manager";
import { VaultSecretManager } from "./vault-secret-manager";
import { LoggerService } from "../observability/logger/logger.service";
import { SecretRotationEmitter } from "./secret-rotation.emitter";

export * from "./secret-manager.interface";
export * from "./local-secret-manager";
export * from "./vault-secret-manager";
export * from "./secret-rotation.emitter";
export * from "./secret-canary";

const secretManagerProvider: Provider = {
	provide: SECRET_MANAGER,
	inject: [ConfigService, LoggerService, SecretRotationEmitter],
	useFactory: (
		configService: ConfigService,
		logger: LoggerService,
		rotationEmitter: SecretRotationEmitter,
	): SecretManager => {
		const provider = configService.get<string>("kms.provider") ?? "local";

		switch (provider) {
			case "vault": {
				const addr = configService.get<string>("kms.vaultAddr");
				const token = configService.get<string>("kms.vaultToken");
				if (!addr || !token) {
					logger.warn(
						"SecretManager: kms.provider='vault' but vaultAddr/vaultToken not configured — falling back to local",
					);
					return new LocalSecretManager(logger);
				}
				return new VaultSecretManager({ addr, token, rotationEmitter });
			}
			case "local":
			default:
				return new LocalSecretManager(logger);
		}
	},
};

@Global()
@Module({
	providers: [secretManagerProvider, SecretRotationEmitter],
	exports: [SECRET_MANAGER, SecretRotationEmitter],
})
export class SecretsModule {}
