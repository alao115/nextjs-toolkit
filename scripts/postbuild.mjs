/**
 * Finishes the dual build.
 *
 * 1. Marks each output directory with its module format, so Node interprets
 *    the .js files correctly regardless of the root package's `type`.
 * 2. Re-introduces the two CommonJS globals the ESM output cannot have.
 *
 * On (2): the source loads optional peer dependencies with `require()` so a
 * static import does not make them mandatory, and `resolveAssets` uses
 * `__dirname`. Both are emitted verbatim into the ESM build, where they are
 * ReferenceErrors. Rather than contort the source to avoid them — or bundle,
 * which would duplicate the Symbol DI tokens across entrypoints and break
 * Nest's provider identity — we prepend the standard ESM equivalents to just
 * the files that need them.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;

const REQUIRE_SHIM =
	'import { createRequire as __createRequire } from "node:module";\n' +
	"const require = __createRequire(import.meta.url);\n";

const DIRNAME_SHIM =
	'import { fileURLToPath as __fileURLToPath } from "node:url";\n' +
	'import { dirname as __pathDirname } from "node:path";\n' +
	"const __filename = __fileURLToPath(import.meta.url);\n" +
	"const __dirname = __pathDirname(__filename);\n";

async function* jsFiles(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* jsFiles(full);
		else if (entry.name.endsWith(".js")) yield full;
	}
}

async function markFormat(dir, type) {
	await writeFile(join(DIST, dir, "package.json"), JSON.stringify({ type }, null, 2) + "\n");
}

async function shimEsm() {
	const patched = [];
	for await (const file of jsFiles(join(DIST, "esm"))) {
		const src = await readFile(file, "utf8");
		let prefix = "";
		// Must be a call with a literal specifier: that is what every lazy
		// optional-peer load looks like. Matching bare `require(` also caught
		// `TenantService.require(op)`, a method that has nothing to do with
		// module loading.
		if (/(?<![\w$.])require\(\s*["']/.test(src)) prefix += REQUIRE_SHIM;
		if (/(?<![\w$.])__dirname(?![\w$])/.test(src)) prefix += DIRNAME_SHIM;
		if (!prefix) continue;
		await writeFile(file, prefix + src);
		patched.push(file.slice(DIST.length));
	}
	return patched;
}

await markFormat("cjs", "commonjs");
await markFormat("esm", "module");
const patched = await shimEsm();

console.log(`postbuild: marked dist/cjs (commonjs) and dist/esm (module)`);
console.log(`postbuild: shimmed ${patched.length} ESM file(s):`);
for (const f of patched) console.log(`  ${f}`);
