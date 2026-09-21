> [!IMPORTANT]
>
> **Deprecated**
>
> **Use the upstream [prettier-plugin-astro](https://www.npmjs.com/package/prettier-plugin-astro) instead.**
>
> As of the [upstream v1.0.1 release](https://github.com/withastro/prettier-plugin-astro/releases/tag/v1.0.1) on September 16, 2026, all fixes this fork existed to patch have been resolved. This fork will no longer be maintained.

---

<!-- title -->

# @kitschpatrol/prettier-plugin-astro

<!-- /title -->

<!-- badges -->

[![NPM Package @kitschpatrol/prettier-plugin-astro](https://img.shields.io/npm/v/@kitschpatrol/prettier-plugin-astro.svg)](https://www.npmjs.com/package/@kitschpatrol/prettier-plugin-astro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/docbook/xslt10-stylesheets/blob/efd62655c11cc8773708df7a843613fa1e932bf8/xsl/COPYING#L27)
[![CI](https://github.com/kitschpatrol/prettier-plugin-astro/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/prettier-plugin-astro/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**A fork of Prettier Plugin Astro with minor fixes.**

<!-- /short-description -->

## Changes

This is a reluctant fork of the official [Prettier Plugin for Astro](https://github.com/withastro/prettier-plugin-astro) with fixes for the following issues that I don't have time to tend PRs for at the moment:

- Fix for: [Conditional inline script with triangle bracket causes syntax error with prettier@3.7.0 and up · Issue #452](https://github.com/withastro/prettier-plugin-astro/issues/452)

- Fix for: [Prettier fails / misparses \<script> when conditionally rendered in .astro template expressions · Issue #454](https://github.com/withastro/prettier-plugin-astro/issues/454)

- Merge of: [fix: implement elements whose children should always have lines between them by Princesseuh · PR #399](https://github.com/withastro/prettier-plugin-astro/pull/399)

- Merge of: [Add failing test · angelikatyborska/prettier-plugin-astro@73bdf9c](https://github.com/angelikatyborska/prettier-plugin-astro/commit/73bdf9ca634338e5e673130e5832136d29e5bd83)

- Aggressive dependency updates, which might be breaking changes for users of older Astro versions < v6.

- Package is built with [tsdown](https://tsdown.dev/).

- Package is ESM-only.

- Repository project template aligned with [kitschpatrol/create-project](https://github.com/kitschpatrol/create-project). (Massive diff, but simplifies management on my end.)

## Branches

- [main](https://github.com/kitschpatrol/prettier-plugin-astro/tree/main) Tracks upstream without modifications.
- [fix-nested-script-tags](https://github.com/kitschpatrol/prettier-plugin-astro/tree/fix-nested-script-tags) Clean merge-able branch of changes.
- [fork-release](https://github.com/kitschpatrol/prettier-plugin-astro/tree/fork-release) Branch with additional project template and readme changes for NPM releases.

## Availability

This package is periodically published from its [fork-release branch](https://github.com/kitschpatrol/prettier-plugin-astro/tree/fork-release) to NPM as @kitschpatrol/prettier-plugin-astro since I need it in some other public projects.

To install:

```sh
pnpm add -D @kitschpatrol/prettier-plugin-astro
```

It will be deprecated when fixes are available upstream.

## More information

Please see the [upstream readme](https://github.com/withastro/prettier-plugin-astro/blob/main/README.md) for more details and documentation on the plugin itself.
