import { ApiProperty } from "@nestjs/swagger";

export class AppResponse<T> {
	@ApiProperty()
	success: boolean;

	@ApiProperty()
	timestamp: string;

	@ApiProperty()
	correlationId: string;

	@ApiProperty({ required: false })
	data?: T;

	@ApiProperty({ required: false })
	error?: any;

	static success<T>(data: T, correlationId: string): AppResponse<T> {
		return {
			success: true,
			timestamp: new Date().toISOString(),
			correlationId,
			data,
		};
	}

	static failure(correlationId: string, error: any): AppResponse<any> {
		return {
			success: false,
			timestamp: new Date().toISOString(),
			correlationId,
			error,
		};
	}
}
