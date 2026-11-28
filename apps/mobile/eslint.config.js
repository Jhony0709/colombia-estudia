const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['.expo/**', 'theme/alba.ts'] },
  { files: ['jest.setup.js'], languageOptions: { globals: { jest: 'readonly' } } },
  {
    // Un color escrito a mano se salta el tema y el modo oscuro (reference/03-ui/tokens.md).
    files: ['**/*.{ts,tsx}'],
    ignores: ['theme/**', '__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Color fuera del tema: usa theme.color[…] o theme/extra.ts.',
        },
      ],
    },
  },
]);
