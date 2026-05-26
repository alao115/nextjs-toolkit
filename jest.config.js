/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	rootDir: ".",
	testMatch: ["**/*.spec.ts"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],
	moduleFileExtensions: ["ts", "js", "json"],
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: {
					module: "commonjs",
					target: "ES2021",
					strict: false,
					esModuleInterop: true,
					skipLibCheck: true,
					experimentalDecorators: true,
					emitDecoratorMetadata: true,
				},
			},
		],
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
