import { defineConfig } from 'tsdown'

export default defineConfig({
	attw: {
		profile: 'esm-only',
	},
	dts: {
		sourcemap: true,
	},
	fixedExtension: false,
	platform: 'node',
	publint: true,
	tsconfig: 'tsconfig.build.json',
	sourcemap: true,
})
