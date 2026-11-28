const { transformIgnorePatterns } = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  resolver: './jest.resolver.js',
  setupFiles: ['./jest.setup.js'],
  // Fluxus llega de npm como módulos ES: se transforma como los de Expo y React Native.
  transformIgnorePatterns: [
    transformIgnorePatterns[0].replace('(?!(.pnpm|', '(?!(.pnpm|@fluxus-ui|'),
    ...transformIgnorePatterns.slice(1),
  ],
};
