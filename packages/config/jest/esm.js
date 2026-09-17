/**
 * Jest `transformIgnorePatterns` for the ESM-only markdown toolchain (unified/remark/micromark)
 * that packages/types pulls in. Any Jest config that can reach @colombia-estudia/types through
 * source mappings needs it; apps/web hit it on 16/9 when a service imported the domain barrel.
 * SSOT for the list; packages/domain and packages/types keep their own copy for now (deuda).
 */
/**
 * Ignore (= do not transform) everything under node_modules EXCEPT the packages below, whether
 * the path is the pnpm store dir (`node_modules/.pnpm/<pkg>@<version>/`) or the package dir
 * (`node_modules/<pkg>/`). The list is the pure-ESM unified/remark/micromark toolchain.
 */
const ESM_PACKAGES = [
  'unified',
  'remark-.*',
  'rehype-.*',
  'unist-util-.*',
  'mdast-util-.*',
  'hast-util-.*',
  'micromark.*',
  'vfile.*',
  'decode-named-character-reference',
  'character-.*',
  'zwitch',
  'bail',
  'trough',
  'is-plain-obj',
  'devlop',
  'longest-streak',
  'ccount',
  'markdown-table',
  'escape-string-regexp',
  'trim-lines',
  'parse-entities',
  'stringify-entities',
  'is-decimal',
  'is-hexadecimal',
  'is-alphanumerical',
  'is-alphabetical',
  'property-information',
  'space-separated-tokens',
  'comma-separated-tokens',
].join('|');

const transformIgnorePatterns = [`/node_modules/(?!(\\.pnpm/)?(${ESM_PACKAGES})(@[^/]+)?/)`];

module.exports = { transformIgnorePatterns };
