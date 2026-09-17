/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  // ESM packages that need to be transformed by @swc/jest.
  // unified/remark ecosystem is pure ESM, so we must exclude them from the default
  // transformIgnorePatterns (which ignores node_modules by default).
  transformIgnorePatterns: [
    '/node_modules/(?!(' +
      'unified|' +
      'remark-parse|' +
      'remark-gfm|' +
      'remark-math|' +
      'remark-directive|' +
      'unist-util-visit|' +
      'unist-util-visit-parents|' +
      'unist-util-is|' +
      'unist-util-stringify-position|' +
      'mdast-util-from-markdown|' +
      'mdast-util-to-string|' +
      'mdast-util-gfm|' +
      'mdast-util-gfm-table|' +
      'mdast-util-gfm-task-list-item|' +
      'mdast-util-gfm-strikethrough|' +
      'mdast-util-gfm-autolink-literal|' +
      'mdast-util-gfm-footnote|' +
      'mdast-util-math|' +
      'mdast-util-directive|' +
      'mdast-util-phrasing|' +
      'micromark|' +
      'micromark-core-commonmark|' +
      'micromark-factory-.*|' +
      'micromark-util-.*|' +
      'micromark-extension-gfm|' +
      'micromark-extension-gfm-table|' +
      'micromark-extension-gfm-task-list-item|' +
      'micromark-extension-gfm-strikethrough|' +
      'micromark-extension-gfm-autolink-literal|' +
      'micromark-extension-gfm-footnote|' +
      'micromark-extension-math|' +
      'micromark-extension-directive|' +
      'vfile|' +
      'vfile-message|' +
      'decode-named-character-reference|' +
      'character-entities|' +
      'character-entities-html4|' +
      'character-entities-legacy|' +
      'character-reference-invalid|' +
      'zwitch|' +
      'bail|' +
      'trough|' +
      'is-plain-obj|' +
      'devlop|' +
      'longest-streak|' +
      'ccount|' +
      'markdown-table|' +
      'escape-string-regexp|' +
      'trim-lines|' +
      'parse-entities|' +
      'stringify-entities|' +
      'is-decimal|' +
      'is-hexadecimal|' +
      'is-alphanumerical|' +
      'is-alphabetical|' +
      'property-information|' +
      'hast-util-whitespace|' +
      'space-separated-tokens|' +
      'comma-separated-tokens' +
    ')/)' +
    '[^/]+\\.m?js$',
  ],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 85,
      functions: 90,
      statements: 90,
    },
  },
};
