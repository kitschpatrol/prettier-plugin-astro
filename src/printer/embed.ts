import { Buffer } from 'node:buffer';
import type { BuiltInParserName, Doc, Options } from 'prettier';
import _doc from 'prettier/doc';
import { SassFormatter, type SassFormatterConfig } from 'sass-formatter';
import type { AttributeNode, ExpressionNode, FragmentNode, Node } from './nodes';
import {
	atSignReplace,
	closingBracketReplace,
	dotReplace,
	inferParserByTypeAttribute,
	interrogationReplace,
	isNodeWithChildren,
	isTagLikeNode,
	isTextNode,
	manualDedent,
	openingBracketReplace,
	printRaw,
	type AstPath,
	type ParserOptions,
	type printFn,
} from './utils';

const {
	builders: { group, indent, join, line, softline, hardline, lineSuffixBoundary },
	utils: { stripTrailingHardline, mapDoc },
} = _doc;

const supportedStyleLangValues = ['css', 'scss', 'sass', 'less'] as const;
type supportedStyleLang = (typeof supportedStyleLangValues)[number];

// https://prettier.io/docs/en/plugins.html#optional-embed
type TextToDoc = (text: string, options: Options) => Promise<Doc>;

type Embed =
	| ((
			path: AstPath,
			options: Options,
	  ) =>
			| ((
					textToDoc: TextToDoc,
					print: (selector?: string | number | Array<string | number> | AstPath) => Doc,
					path: AstPath,
					options: Options,
			  ) => Promise<Doc | undefined> | Doc | undefined)
			| Doc
			| null)
	| undefined;

export const embed = ((path: AstPath, options: Options) => {
	const parserOption = options as ParserOptions;
	return async (textToDoc, print) => {
		const node = path.node;

		if (!node) return undefined;

		if (node.type === 'expression') {
			// Extract script and style elements and replace with self-closing
			// placeholder components so Babel's JSX parser doesn't try to parse
			// their content as JSX.
			// See: https://github.com/withastro/prettier-plugin-astro/issues/452
			// See: https://github.com/withastro/prettier-plugin-astro/issues/454
			const rawTagPlaceholders: RawTagPlaceholder[] = [];
			const nodeWithPlaceholders = replaceRawTagChildren(node, rawTagPlaceholders);

			const jsxNode = makeNodeJSXCompatible<ExpressionNode>(nodeWithPlaceholders);
			const textContent = printRaw(jsxNode);

			let content: Doc;

			content = await wrapParserTryCatch(textToDoc, textContent, {
				...options,
				parser: 'astroExpressionParser',
			});

			content = stripTrailingHardline(content);

			// Replace self-closing placeholder components with fully-rendered
			// script/style tags, matching the format of the top-level handlers.
			for (const entry of rawTagPlaceholders) {
				let formattedContent: Doc;

				if (entry.tagName === 'script') {
					const parser = inferParserByTypeAttribute(entry.typeAttr || '');
					formattedContent = await wrapParserTryCatch(textToDoc, entry.content, {
						...options,
						parser,
					});
				} else {
					// style tag
					const langValue = entry.langAttr?.toLowerCase();
					if (langValue === 'sass') {
						const lineEnding = parserOption?.endOfLine?.toUpperCase() === 'CRLF' ? 'CRLF' : 'LF';
						const sassOptions: Partial<SassFormatterConfig> = {
							tabSize: parserOption.tabWidth,
							insertSpaces: !parserOption.useTabs,
							lineEnding,
						};
						const { result: raw } = manualDedent(entry.content);
						const formatted = SassFormatter.Format(raw, sassOptions).trim();
						formattedContent = join(hardline, formatted.split('\n'));
					} else {
						// css, scss, less, or default to css
						const styleParser: BuiltInParserName =
							langValue === 'scss' || langValue === 'less' ? langValue : 'css';
						formattedContent = await wrapParserTryCatch(textToDoc, entry.content, {
							...options,
							parser: styleParser,
						});
					}
				}

				formattedContent = stripTrailingHardline(formattedContent);
				const isEmpty = /^\s*$/.test(entry.content);

				// Build the full tag Doc matching top-level script/style formatting:
				// <tag attrs>\n  content\n</tag>
				const fullTagDoc: Doc = [
					entry.openingTag,
					indent([isEmpty ? '' : hardline, formattedContent]),
					isEmpty ? '' : hardline,
					`</${entry.tagName}>`,
				];

				content = mapDoc(content, (doc) => {
					if (typeof doc === 'string' && doc.includes(entry.placeholder)) {
						const parts = doc.split(entry.placeholder);
						if (parts.length === 2) {
							if (entry.isDirectChild) {
								// Direct children: placeholder replaced the entire element,
								// so insert the fully-rendered tag Doc
								return [parts[0], fullTagDoc, parts[1]];
							}
							// Nested children: placeholder is inside the tag, the tag
							// structure is preserved in the doc. Replace content only.
							if (isEmpty) {
								return [parts[0], parts[1]];
							}
							return [parts[0], indent([hardline, formattedContent]), hardline, parts[1]];
						}
					}
					return doc;
				});
			}

			// HACK: Bit of a weird hack to get if a document is exclusively comments
			// Using `mapDoc` directly to build the array for some reason caused it to always be undefined? Not sure why
			const strings: string[] = [];
			mapDoc(content, (doc) => {
				if (typeof doc === 'string') {
					strings.push(doc);
				}
			});

			if (strings.every((value) => value.startsWith('//'))) {
				return group(['{', content, softline, lineSuffixBoundary, '}']);
			}

			// Create a Doc without the things we had to add to make the expression compatible with Babel
			const astroDoc = mapDoc(content, (doc) => {
				if (typeof doc === 'string') {
					doc = doc.replaceAll(openingBracketReplace, '{');
					doc = doc.replaceAll(closingBracketReplace, '}');
					doc = doc.replaceAll(atSignReplace, '@');
					doc = doc.replaceAll(dotReplace, '.');
					doc = doc.replaceAll(interrogationReplace, '?');
				}

				return doc;
			});

			// Force multi-line format for expressions containing raw content tags
			// (script/style), since their content has hardlines that need proper
			// indentation context. Without this, babel may keep the expression on
			// one line, causing misaligned content after placeholder replacement.
			if (rawTagPlaceholders.length > 0) {
				return ['{', indent([hardline, astroDoc]), hardline, lineSuffixBoundary, '}'];
			}

			return group(['{', indent([softline, astroDoc]), softline, lineSuffixBoundary, '}']);
		}

		// Attribute using an expression as value
		if (node.type === 'attribute' && node.kind === 'expression') {
			const value = node.value.trim();
			const name = node.name.trim();

			const attrNodeValue = await wrapParserTryCatch(textToDoc, value, {
				...options,
				parser: 'astroExpressionParser',
			});

			if (name === value && options.astroAllowShorthand) {
				return [line, '{', attrNodeValue, '}'];
			}

			return [line, name, '=', '{', attrNodeValue, '}'];
		}

		if (node.type === 'attribute' && node.kind === 'spread') {
			const spreadContent = await wrapParserTryCatch(textToDoc, node.name, {
				...options,
				parser: 'astroExpressionParser',
			});

			return [line, '{...', spreadContent, '}'];
		}

		// Frontmatter
		if (node.type === 'frontmatter') {
			if (options.astroSkipFrontmatter) {
				return [group(['---', node.value, '---', hardline]), hardline];
			}

			const frontmatterContent = await wrapParserTryCatch(textToDoc, node.value, {
				...options,
				parser: 'babel-ts',
			});

			return [group(['---', hardline, frontmatterContent, hardline, '---', hardline]), hardline];
		}

		// Script tags
		if (node.type === 'element' && node.name === 'script' && node.children.length) {
			const typeAttribute = node.attributes.find((attr) => attr.name === 'type')?.value;

			let parser: BuiltInParserName = 'babel-ts';
			if (typeAttribute) {
				parser = inferParserByTypeAttribute(typeAttribute);
			}

			const scriptContent = printRaw(node);
			let formattedScript = await wrapParserTryCatch(textToDoc, scriptContent, {
				...options,
				parser: parser,
			});

			formattedScript = stripTrailingHardline(formattedScript);
			const isEmpty = /^\s*$/.test(scriptContent);

			// print
			const attributes = path.map(print, 'attributes');
			const openingTag = group([
				'<script',
				indent(group(attributes)),
				options.bracketSameLine ? '' : softline,
				'>',
			]);
			return [
				openingTag,
				indent([isEmpty ? '' : hardline, formattedScript]),
				isEmpty ? '' : hardline,
				'</script>',
			];
		}

		// Style tags
		if (node.type === 'element' && node.name === 'style') {
			const content = printRaw(node);
			let parserLang: supportedStyleLang | undefined = 'css';

			if (node.attributes) {
				const langAttribute = node.attributes.filter((x) => x.name === 'lang');
				if (langAttribute.length) {
					const styleLang = langAttribute[0].value.toLowerCase() as supportedStyleLang;
					parserLang = supportedStyleLangValues.includes(styleLang) ? styleLang : undefined;
				}
			}

			return await embedStyle(parserLang, content, path, print, textToDoc, parserOption);
		}

		return undefined;
	};
}) satisfies Embed;

async function wrapParserTryCatch(cb: TextToDoc, text: string, options: Options) {
	try {
		return await cb(text, options);
	} catch (e) {
		// If we couldn't parse the expression (ex: syntax error) and we throw here, Prettier fallback to `print` and we'll
		// get a totally useless error message (ex: unhandled node type). An undocumented way to work around this is to set
		// `PRETTIER_DEBUG=1`, but nobody know that exists / want to do that just to get useful error messages. So we force it on
		process.env.PRETTIER_DEBUG = 'true';
		throw e;
	}
}

/**
 * Due to the differences between Astro and JSX, Prettier's TypeScript parsers (be it `typescript` or `babel-ts`) are not
 * able to parse all expressions. So we need to first make the expression compatible before passing it to the parser
 *
 * A list of the difference that matters here:
 * - Astro allows a shorthand syntax for props. ex: `<Component {props} />`
 * - Astro allows multiple root elements. ex: `<div></div><div></div>`
 * - Astro allows attributes to include at signs (@) and dots (.)
 */
function makeNodeJSXCompatible<T>(node: any): T {
	const newNode = { ...node };
	const childBundle: Node[][] = [];
	let childBundleIndex = 0;

	if (isNodeWithChildren(newNode)) {
		newNode.children = newNode.children.reduce((result: Node[], child, index) => {
			const previousChildren = newNode.children[index - 1];
			const nextChildren = newNode.children[index + 1];
			if (isTagLikeNode(child)) {
				child.attributes = child.attributes.map(makeAttributeJSXCompatible);

				if (!childBundle[childBundleIndex]) {
					childBundle[childBundleIndex] = [];
				}

				if (isNodeWithChildren(child)) {
					child = makeNodeJSXCompatible<typeof child>(child);
				}

				// If we don't have a previous children, or it's not an element AND
				// we have a next children, and it's an element. Add the current children to the bundle
				if (
					(!previousChildren || isTextNode(previousChildren)) &&
					nextChildren &&
					isTagLikeNode(nextChildren)
				) {
					childBundle[childBundleIndex].push(child);
					return result;
				}

				// If we have a previous children, and it's an element AND
				// we have a next children, and it's also an element. Add the current children to the bundle
				if (
					previousChildren &&
					isTagLikeNode(previousChildren) &&
					nextChildren &&
					isTagLikeNode(nextChildren)
				) {
					childBundle[childBundleIndex].push(child);
					return result;
				}

				// If we have elements in our bundle, and there's no next children, or it's a text node
				// Create a fake parent, and add all the previous encountered elements as children of it
				if (
					(!nextChildren || isTextNode(nextChildren)) &&
					childBundle[childBundleIndex].length > 0
				) {
					childBundle[childBundleIndex].push(child);

					const parentNode: FragmentNode = {
						type: 'fragment',
						name: '',
						attributes: [],
						children: childBundle[childBundleIndex],
					};

					childBundleIndex += 1;
					result.push(parentNode);
					return result;
				}
			} else {
				childBundleIndex += 1;
			}

			result.push(child);
			return result;
		}, []);
	}

	return newNode;

	function makeAttributeJSXCompatible(attr: AttributeNode): AttributeNode {
		// Transform shorthand attributes into an empty attribute, ex: `{shorthand}` becomes `shorthand` and wrap it
		// so we can transform it back into {}
		if (attr.kind === 'shorthand') {
			attr.kind = 'empty';
			attr.name = openingBracketReplace + attr.name + closingBracketReplace;
		}

		// For spreads, we don't need to do anything because it should already be JSX compatible
		if (attr.kind !== 'spread') {
			if (attr.name.includes('@')) {
				attr.name = attr.name.replaceAll('@', atSignReplace);
			}

			if (attr.name.includes('.')) {
				attr.name = attr.name.replaceAll('.', dotReplace);
			}

			if (attr.name.includes('?')) {
				attr.name = attr.name.replaceAll('?', interrogationReplace);
			}
		}

		return attr;
	}
}

/** Tags whose content is raw text (not JSX) and must be extracted before Babel parsing */
const rawContentTags = ['script', 'style'] as const;

interface RawTagPlaceholder {
	placeholder: string;
	content: string;
	tagName: (typeof rawContentTags)[number];
	openingTag: string; // the serialized opening tag, e.g. '<script is:inline>'
	isDirectChild: boolean; // true if direct child of expression (vs nested in fragment)
	typeAttr?: string; // for script
	langAttr?: string; // for style
}

/**
 * Replace the children of any raw-content elements (script, style) in an expression
 * node with placeholder text nodes. This prevents Babel's JSX parser from trying to
 * parse their content as JSX when they appear inside an expression.
 *
 * See: https://github.com/withastro/prettier-plugin-astro/issues/452
 * See: https://github.com/withastro/prettier-plugin-astro/issues/454
 */
function replaceRawTagChildren(
	node: any,
	placeholders: RawTagPlaceholder[],
	isTopLevel = true,
): any {
	const newNode = { ...node };
	if (isNodeWithChildren(newNode)) {
		newNode.children = newNode.children.map((child: any) => {
			if (
				child.type === 'element' &&
				rawContentTags.includes(child.name) &&
				child.children.length
			) {
				const placeholder = `__ASTRO_RAW_TAG_PLACEHOLDER_${placeholders.length}__`;
				const content = printRaw(child);

				// Build the opening tag string from the original element
				const attrs = (child.attributes || [])
					.map((a: AttributeNode) => {
						if (a.kind === 'empty') return a.name;
						if (a.kind === 'expression') return `${a.name}={${a.value}}`;
						if (a.kind === 'spread') return `{...${a.name}}`;
						return `${a.name}="${a.value}"`;
					})
					.join(' ');
				const openingTag = attrs ? `<${child.name} ${attrs}>` : `<${child.name}>`;

				placeholders.push({
					placeholder,
					content,
					tagName: child.name,
					openingTag,
					// Whether this tag is a direct child of the expression (not nested
					// inside a fragment/element). Direct children are replaced entirely
					// so babel formats the expression around a simple identifier. Nested
					// children keep their tag structure for proper fragment formatting.
					isDirectChild: isTopLevel,
					typeAttr: child.attributes?.find((a: AttributeNode) => a.name === 'type')?.value,
					langAttr: child.attributes?.find((a: AttributeNode) => a.name === 'lang')?.value,
				});

				if (isTopLevel) {
					// Replace the entire element with a text placeholder.
					// Babel sees it as a simple identifier, keeping it on its own
					// line when the expression handler forces multi-line format.
					return { type: 'text', value: placeholder };
				}
				// Nested: replace only children, preserving the tag structure so
				// babel can format it properly within fragments/wrappers.
				return {
					...child,
					children: [{ type: 'text', value: placeholder }],
				};
			}
			if (isNodeWithChildren(child)) {
				return replaceRawTagChildren(child, placeholders, false);
			}
			return child;
		});
	}
	return newNode;
}

/**
 * Format the content of a style tag and print the entire element
 */
async function embedStyle(
	lang: supportedStyleLang | undefined,
	content: string,
	path: AstPath,
	print: printFn,
	textToDoc: TextToDoc,
	options: ParserOptions,
): Promise<_doc.builders.Doc | undefined> {
	const isEmpty = /^\s*$/.test(content);

	switch (lang) {
		case 'less':
		case 'css':
		case 'scss': {
			let formattedStyles = await wrapParserTryCatch(textToDoc, content, {
				...options,
				parser: lang,
			});

			// The css parser appends an extra indented hardline, which we want outside of the `indent()`,
			// so we remove the last element of the array
			formattedStyles = stripTrailingHardline(formattedStyles);

			// print
			const attributes = path.map(print, 'attributes');
			const openingTag = group(['<style', indent(group(attributes)), softline, '>']);
			return [
				openingTag,
				indent([isEmpty ? '' : hardline, formattedStyles]),
				isEmpty ? '' : hardline,
				'</style>',
			];
		}
		case 'sass': {
			const lineEnding = options?.endOfLine?.toUpperCase() === 'CRLF' ? 'CRLF' : 'LF';
			const sassOptions: Partial<SassFormatterConfig> = {
				tabSize: options.tabWidth,
				insertSpaces: !options.useTabs,
				lineEnding,
			};

			// dedent the .sass, otherwise SassFormatter gets indentation wrong
			const { result: raw } = manualDedent(content);

			// format
			const formattedSassIndented = SassFormatter.Format(raw, sassOptions).trim();

			// print
			const formattedSass = join(hardline, formattedSassIndented.split('\n'));
			const attributes = path.map(print, 'attributes');
			const openingTag = group(['<style', indent(group(attributes)), softline, '>']);
			return [
				openingTag,
				indent([isEmpty ? '' : hardline, formattedSass]),
				isEmpty ? '' : hardline,
				'</style>',
			];
		}
		case undefined: {
			const node = path.getNode();

			if (node) {
				return Buffer.from(options.originalText)
					.subarray(options.locStart(node), options.locEnd(node))
					.toString();
			}

			return undefined;
		}
	}
}
