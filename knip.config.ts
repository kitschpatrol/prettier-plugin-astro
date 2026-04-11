import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	ignore: [
		'test/fixtures/other/embedded-expr-options/custom-plugin.js',
		'test/fixtures/other/embedded-expr-options/options.js',
	],
	rules: {
		unlisted: 'warn',
		exports: 'off',
	},
})
