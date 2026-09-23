import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"dist/**",
			"node_modules/**",
			"examples/**/node_modules/**",
			"examples/**/dist/**",
			"coverage/**",
		],
	},

	...tseslint.configs.recommended,

	{
		rules: {
			// `any` is load-bearing here: the persistence and audit adapters
			// deliberately avoid coupling to a generated Prisma schema, and the
			// logging/metrics contracts take open-ended context objects.
			"@typescript-eslint/no-explicit-any": "off",

			// Optional peer dependencies are loaded with `require()` on purpose so
			// a static import does not make them mandatory. See the comments in
			// error-tracker.module.ts, crypto.util.ts, notification.module.ts.
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-var-requires": "off",

			// Unused args are fine when prefixed with `_` — the in-memory adapters
			// implement interfaces they intentionally no-op.
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],

			// Catch the mistakes that actually bite in this codebase.
			eqeqeq: ["error", "smart"],
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	{
		// Tests may shadow and re-declare freely, and console output is useful there.
		files: ["**/*.spec.ts", "**/*.test.ts"],
		rules: { "no-console": "off" },
	},

	{
		// Reference snippets, not shipped code (they are excluded from the build
		// tsconfig). They import more than they use on purpose, to show what a
		// real integration pulls in, and they print to explain themselves.
		files: ["examples/**/*.ts", "scripts/**/*.mjs"],
		rules: {
			"@typescript-eslint/no-unused-vars": "off",
			"no-console": "off",
		},
	},

	{
		// Places where the console *is* the intended sink: the fallback logging
		// adapter, LoggerService's no-adapter path, and the ngrok tunnel URL
		// (printed before any logger exists).
		files: [
			"observability/logger/adapters/default-logging.adapter.ts",
			"observability/logger/logger.service.ts",
			"bootstrap/setup-ngrok-proxy.module.ts",
		],
		rules: { "no-console": "off" },
	},
);
