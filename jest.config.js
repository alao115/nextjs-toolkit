/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	rootDir: ".",
	testMatch: ["**/*.spec.ts"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],
	moduleFileExtensions: ["ts", "js", "json"],
	transform: {
		// Compile tests with the same strictness as the package itself.
		// This used to be an inline config with `strict: false`, which — combined
		// with the build tsconfig excluding `*.spec.ts` — meant test files were
		// never type-checked by anything.
		"^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.spec.json" }],
	},
	collectCoverageFrom: [
		"**/*.ts",
		"!**/*.spec.ts",
		"!**/index.ts",
		"!**/*.module.ts",
		"!**/dist/**",
		"!**/node_modules/**",
	],
};
