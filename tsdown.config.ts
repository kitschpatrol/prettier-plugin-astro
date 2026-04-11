import { defineConfig } from 'tsdown'

export default defineConfig({
	attw: {
		profile: 'esm-only',
	},
	dts: true,
	fixedExtension: false,
	platform: 'node',
	publint: true,
	tsconfig: 'tsconfig.build.json',
})
