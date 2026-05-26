import { PassThrough } from "stream";

export const STORAGE_ADAPTERS = Symbol("STORAGE_ADAPTERS");

export function getBucketNameFromDestination(
	buckets: any,
	destination: string,
) {
	const bucketName = destination.split("/")[0];
	const bucket = buckets[bucketName === "public-share" ? "public" : bucketName];

	return bucket;
}

export function forkReadable(stream: NodeJS.ReadableStream, countBytes = false) {
	const main = new PassThrough();
	const side = new PassThrough();

	stream.pipe(main);
	stream.pipe(side);

	let sizePromise: Promise<number> | null = null;

	if (countBytes) {
		sizePromise = (async () => {
			let total = 0;
			for await (const chunk of side) {
				total += chunk.length;
			}
			return total;
		})();
	}

	return { main, side, sizePromise };
}
