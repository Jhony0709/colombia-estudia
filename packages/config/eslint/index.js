/**
 * ESLint configuration for Colombia Estudia
 *
 * jsx-a11y set to strict mode for WCAG 2.2 AA compliance
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript', 'plugin:jsx-a11y/strict'],
  plugins: ['jsx-a11y'],
  rules: {
    // TypeScript strict
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/strict-boolean-expressions': 'off',

    // jsx-a11y strict overrides
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/no-static-element-interactions': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/html-has-lang': 'error',
    'jsx-a11y/lang': 'error',
    'jsx-a11y/no-autofocus': 'error',
    'jsx-a11y/no-redundant-roles': 'error',
    'jsx-a11y/label-has-associated-control': 'error',

    // Forbid role checks - use capabilities
    'no-restricted-syntax': [
      'error',
      {
        selector: "BinaryExpression[left.property.name='role'][operator='===']",
        message:
          'Do not check role directly. Use capabilities from packages/domain/src/capabilities.ts',
      },
      {
        selector: "BinaryExpression[left.property.name='role'][operator='==']",
        message:
          'Do not check role directly. Use capabilities from packages/domain/src/capabilities.ts',
      },
    ],

    // Console statements
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
