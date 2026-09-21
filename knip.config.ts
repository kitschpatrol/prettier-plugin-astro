import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	ignore: [
		'test/fixtures/other/embedded-expr-options/custom-plugin.js',
		'test/fixtures/other/embedded-expr-options/options.js',
		// Type-level test, only ever checked by tsc
		'test/types/plugin-options.ts',
	],
	rules: {
		unlisted: 'warn',
		exports: 'off',
	},
})
