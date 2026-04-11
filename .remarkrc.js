import { remarkConfig } from '@kitschpatrol/remark-config'

export default remarkConfig({
	rules: [
		// Useful if the repository is not yet pushed to a remote.
		['remarkValidateLinks', { repository: false }],
		['remark-lint-first-heading-level', false],
		['remark-lint-heading-increment', false],
		['remark-lint-fenced-code-flag', false],
	],
})
