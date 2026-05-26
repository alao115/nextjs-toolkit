/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";
import { IStorageAdapter } from "../../file-storage.types";

@Injectable()
export class DiskStorageAdapter implements IStorageAdapter {
	name = "disk";
	constructor() {}

	saveFile(file: any, path?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			resolve(file.originalname);
		});
	}

	deleteFile(key: string): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	getFileUrl(key: string): string {
		return key;
	}

	streamFile(key: string): NodeJS.ReadableStream {
		return {} as NodeJS.ReadableStream;
	}
}
