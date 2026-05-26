import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { FileStorageService } from "./file-storage.service";

@Injectable()
export class FileStorageOwnerGuard implements CanActivate {
	constructor(private readonly filesService: FileStorageService) {}
	async canActivate(context: ExecutionContext) {
		const req = context.switchToHttp().getRequest();
		const fileId = req.params.id;
		const file = await this.filesService.getFile(fileId);
		// TODO: reevaluate the implementation
		// return file.ownerId === req.user.id;
		return true;
	}
}
