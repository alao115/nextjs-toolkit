import { Request } from "express";
import { FileNotFoundError } from "./errors/file-not-found.error";

export interface IStorageAdapter {
	name: string;
	saveInBucket?: (
		file: IUploadedFile,
		bucket: string,
		key: string,
		metaData?: Record<string, any>,
		ttl?: string,
	) => Promise<string>;
	getFileStatFromBucket?: (bucket: string, key: string) => Promise<any>;
	deleteFileFromBucket?: (bucket: string, key: string) => Promise<void>;
	saveFile?: (file: any, path?: string) => Promise<string>; // returns URL or key
	deleteFile?: (key: string) => Promise<void>;
	getFileUrl?: (key: string) => string;
	getFileUrlFromBucket?: (
		bucket: string,
		key: string,
	) => string | Promise<string>;
	streamFile?: (key: string) => NodeJS.ReadableStream;
	getStreamFromBucket?: (
		bucket: string,
		key: string,
	) => NodeJS.ReadableStream | Promise<NodeJS.ReadableStream>;
}

export interface IFileEntity {
	id?: string;
	originalname: string;
	encoding?: string;
	mimetype: string;
	destination: string;
	url?: string;
	filename: string;
	size: number;
	createdAt?: Date;
	updatedAt?: Date;
	toJSON(): Partial<IFileEntity>;
	isNull(): boolean;
	throwNotFoundError(id?: string): void;
}

export class FileEntity implements IFileEntity {
	private props: IFileEntity | null;

	constructor(fileProps: IFileEntity | null) {
		this.props = fileProps ? Object.freeze({ ...fileProps }) : null;
	}

	private assertPresent(): IFileEntity {
		if (!this.props) {
			throw new FileNotFoundError();
		}
		return this.props;
	}

	get id(): string {
		return this.assertPresent().id ?? "";
	}

	get originalname(): string {
		return this.assertPresent().originalname;
	}

	get encoding(): string {
		return this.assertPresent().encoding ?? "";
	}

	get mimetype(): string {
		return this.assertPresent().mimetype;
	}

	get destination(): string {
		return this.assertPresent().destination;
	}

	get filename(): string {
		return this.assertPresent().filename;
	}

	get size(): number {
		return this.assertPresent().size;
	}

	get createdAt(): Date {
		return this.assertPresent().createdAt ?? new Date(0);
	}

	get updatedAt(): Date {
		return this.assertPresent().updatedAt ?? new Date(0);
	}

	get url(): string {
		return this.assertPresent().url ?? "";
	}

	isNull(): boolean {
		return !this.props;
	}

	throwNotFoundError() {
		throw new FileNotFoundError();
	}

	toJSON(): Partial<IFileEntity> {
		if (!this.props) return {};
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { destination, ...rest } = this.props;
		return rest;
	}
}

export interface IMulterStorageAdapter {
	_handleFile(
		req: Request,
		file: any,
		cb: (err: Error | null, data?: any) => void,
	): void;
	_removeFile(
		req: Request,
		file: any,
		cb: (err: Error | null, data?: any) => void,
	): void;
}

export interface IUploadedFile {
	fieldname?: string;
	originalname: string;
	encoding?: string;
	mimetype: string;
	destination?: string;
	filename: string;
	size: number;
	stream?: NodeJS.ReadableStream;
	buffer?: Buffer;
}
