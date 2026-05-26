import { join } from "path";

export * from "./pagination";

export function resolveAssets(relativePath: string) {
	return join(__dirname, relativePath);
}

export function minutesFromNow(minutes = 10) {
	return new Date(Date.now() + minutes * 60 * 1000);
}

export async function catchError<T>(
	func: Promise<T>,
): Promise<
	| [undefined, T]
	| [Error & { status: number; details: any }, undefined]
> {
	try {
		const data = await func;
		return [undefined, data];
	} catch (err) {
		return [err as Error & { status: number; details: any }, undefined];
	}
}
