// Relative path: apps/web does not depend on @colombia-estudia/config (tsconfig extends by path too).
const { transformIgnorePatterns } = require('../../packages/config/jest/esm');

/** @type {import('jest').Config} */
module.exports = {
  // Default: node. With `jsdom`, Jest resolves packages with the `browser` export condition
  // and Prisma loads `.prisma/client/index-browser.js` ("PrismaClient is unable to run in this
  // browser environment"): the tenant-isolation test failed that way on 15/9. Server code and
  // integration tests need node; component tests (Testing Library) declare
  // `/** @jest-environment jsdom */` in their own docblock.
  testEnvironment: 'node',
  // ESM-only markdown deps reached through @colombia-estudia/domain → types (see packages/config/jest/esm.js).
  transformIgnorePatterns,
  transform: {
    // React 17+ automatic JSX runtime: components don't need `import React` for JSX.
    // (The 15/9 session added `import React` to every .tsx as a workaround; the config is
    // the right place to fix it.)
    '^.+\\.(t|j)sx?$': ['@swc/jest', { jsc: { transform: { react: { runtime: 'automatic' } } } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `server-only` throws when imported outside RSC; services import it and tests import services.
    '^server-only$': '<rootDir>/__tests__/mocks/server-only.js',
    '^@colombia-estudia/domain$': '<rootDir>/../../packages/domain/src',
    '^@colombia-estudia/types$': '<rootDir>/../../packages/types/src',
    '^@colombia-estudia/types/(.*)$': '<rootDir>/../../packages/types/src/$1',
    '^@colombia-estudia/design-tokens$': '<rootDir>/../../packages/design-tokens/src',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  // Co-located component tests (components/**, features/**) count too: on 15/9
  // components/atoms/button/Button.test.tsx never ran because only __tests__/** matched.
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx',
    '<rootDir>/components/**/*.test.tsx',
    '<rootDir>/features/**/*.test.{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'features/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
