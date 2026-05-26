/* eslint-disable @typescript-eslint/no-this-alias */
import { IMulterStorageAdapter } from "../../file-storage.types";
import { Request } from "express";
import * as fs from "fs";
import * as path from "path";
import { Transform } from "stream";

export class MulterDiskStorageAdapter implements IMulterStorageAdapter {
	private _destination: string;
	private size: number = 0;

	constructor(opts: { destination: string }) {
		this._destination = opts.destination;
	}

	private get _getSizeStream() {
		// Create a transform stream to calculate the size of the file
		const sizeTransform = new Transform({ objectMode: true });

		const currentObj = this;
		sizeTransform._transform = function (chunk, encoding, done) {
			currentObj.size += chunk.length;
			this.push(chunk);
			done();
		};

		sizeTransform._flush = function (done) {
			this.push(null);
			done();
		};

		return sizeTransform;
	}

	_handleFile(
		req: Request,
		file: any,
		cb: (err: Error | null, data: any) => void,
	) {
		const fileExt = path.extname(file.originalname);
		const filename =
			Date.now() + "" + Math.round(Math.random() * 1e9) + fileExt;
		const destination = path.join(this._destination, filename);

		if (!fs.existsSync(this._destination)) {
			fs.mkdirSync(this._destination);
		}

		const stream = fs.createWriteStream(destination);

		const currentObj = this;
		file.stream.once("end", function () {
			cb(null, { filename, destination, size: currentObj.size, ...file });
		});
		file.stream.once("error", function (err: Error) {
			cb(err, null);
		});
		file.stream.pipe(this._getSizeStream).pipe(stream);
	}

	_removeFile(
		req: Request,
		file: any,
		cb: (err: Error | null, data?: any) => void,
	) {
		fs.unlink(path.join(this._destination), cb);
	}
}
