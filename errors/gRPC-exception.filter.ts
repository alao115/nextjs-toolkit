/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	ArgumentsHost,
	Catch,
	HttpCode as status,
	RpcExceptionFilter,
} from "@nestjs/common";
import { BaseException } from "./base.exception";

@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<any> {
	catch(exception: unknown, host: ArgumentsHost) {
		//   const context = host.switchToRpc();
		//   const request = context.getContext(); // gRPC call context
		//   const code = status.INTERNAL;
		//   const message = 'Internal server error';

		//   if (exception instanceof BaseException) {
		//     message = exception.message;
		//     code = mapHttpToGrpcStatus(exception.httpStatus || 500);
		//   }

		//   // Logging
		//   // logger.error(`[gRPC] ${message}`, 'GrpcExceptionFilter');

		//   // return new RpcException({ code, message });
		return {} as any;
	}
}

// function mapHttpToGrpcStatus(httpStatus: number): number {
// switch (httpStatus) {
//   case 400:
//     return status.INVALID_ARGUMENT;
//   case 401:
//     return status.UNAUTHENTICATED;
//   case 403:
//     return status.PERMISSION_DENIED;
//   case 404:
//     return status.NOT_FOUND;
//   default:
//     return status.INTERNAL;
// }
// }
