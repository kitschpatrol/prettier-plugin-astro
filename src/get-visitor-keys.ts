export function getVisitorKeys(node: unknown): string[] {
	if (node === null || typeof node !== 'object') {return [];}

	return Object.keys(node).filter((key) => {
		const value = (node as Record<string, unknown>)[key];
		return (
			(typeof value === 'object' &&
				value !== null &&
				key !== 'position' && // skip position metadata
				key !== 'type' && // skip node type itself
				!Array.isArray(value)) ||
			(Array.isArray(value) && value.length > 0 && typeof value[0] === 'object')
		);
	});
}
