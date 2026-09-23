import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// `describe` / `it` / `expect` / `vi` as globals, matching the style the
		// existing specs were written in.
		globals: true,
		environment: "node",
		include: ["**/*.spec.ts"],
		exclude: ["node_modules/**", "dist/**", "examples/**"],
		coverage: {
			provider: "v8",
			include: ["**/*.ts"],
			exclude: [
				"**/*.spec.ts",
				"**/index.ts",
				"**/*.module.ts",
				"dist/**",
				"node_modules/**",
				"examples/**",
				"scripts/**",
				"types/**",
				"*.config.ts",
			],
		},
	},
	esbuild: {
		// The source relies on decorator metadata for Nest DI.
		target: "es2021",
	},
});
