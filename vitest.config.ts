import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// Upstream serializes test files because `embed` flips `process.env.PRETTIER_DEBUG`
		// globally when surfacing parser errors.
		fileParallelism: false,
		pool: 'forks',
	},
})
