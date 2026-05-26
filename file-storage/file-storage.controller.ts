import {
	Controller,
	Get,
	Param,
	Post,
	StreamableFile,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FileStorageService } from "./file-storage.service";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { SingleFileUploadDto } from "./dto/single-file-upload.dto";
import { IUploadedFile } from "./file-storage.types";

@ApiTags("File Storage")
@Controller("files-storage")
export class FileStorageController {
	constructor(private readonly filesService: FileStorageService) {}

	@ApiBearerAuth()
	@Post("upload-public-share")
	@ApiOperation({ summary: "Upload a single file for public share" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		type: SingleFileUploadDto,
		description: "File to upload",
		required: true,
	})
	@UseInterceptors(FileInterceptor("file"))
	async uploadSingle(@UploadedFile() file: IUploadedFile) {
		return this.filesService.uploadPublicFile(file);
	}

	@ApiOperation({ summary: "Download a file" })
	@Get("public-download/:id")
	async download(@Param("id") id: string) {
		const { stream, filename, mimetype, size } =
			await this.filesService.streamFile(id);

		return new StreamableFile(stream as any, {
			type: mimetype,
			disposition: `inline; filename=${filename}`,
			length: size,
		});
	}

	@ApiBearerAuth()
	@ApiOperation({ summary: "Private download a file" })
	@Get("private-download/:id")
	async privateDownload(@Param("id") id: string) {
		const { stream, filename, mimetype, size } =
			await this.filesService.streamFile(id);

		return new StreamableFile(stream as any, {
			type: mimetype,
			disposition: `attachment; filename=${filename}`,
			length: size,
		});
	}
}
