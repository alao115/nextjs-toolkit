import { ApiProperty } from "@nestjs/swagger";

export class MultipleFilesUploadDto {
	@ApiProperty({ type: "array", items: { type: "string", format: "binary" } })
	files: any[];
}
