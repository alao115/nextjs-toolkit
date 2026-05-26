/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"perf",
				"refactor",
				"docs",
				"test",
				"build",
				"ci",
				"chore",
				"revert",
			],
		],
		"scope-case": [2, "always", "kebab-case"],
		"subject-case": [
			2,
			"never",
			["sentence-case", "start-case", "pascal-case", "upper-case"],
		],
		"body-max-line-length": [1, "always", 100],
	},
};
