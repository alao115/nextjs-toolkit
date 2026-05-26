type IncludeTree = Record<string, true | { include: IncludeTree }>;

function ensureBranch(root: IncludeTree, path: string[]): void {
	if (path.length === 0) return;

	const [head, ...rest] = path;

	if (!root[head]) {
		root[head] = rest.length === 0 ? true : { include: {} };
	}

	if (rest.length > 0) {
		const node = root[head] as { include: IncludeTree };
		if (!node.include) {
			node.include = {};
		}
		ensureBranch(node.include, rest);
	}
}

export function buildInclude(includes?: string[]): IncludeTree | undefined {
	if (!includes || includes.length === 0) return undefined;

	const root: IncludeTree = {};

	for (const item of includes) {
		const parts = item.split(".").filter(Boolean);
		if (parts.length === 0) continue;
		ensureBranch(root, parts);
	}

	return root;
}
