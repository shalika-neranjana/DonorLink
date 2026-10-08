// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const jestGlobals = {
  jest: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
};

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  structuredClone: 'readonly',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'appwrite/.build/*',
      // Generated from src/domain by appwrite/package-function.mjs
      'appwrite/functions/api/src/domain/*',
    ],
  },
  {
    // Appwrite Function (CommonJS on Node)
    files: ['appwrite/functions/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: nodeGlobals },
  },
  {
    // Provisioning scripts (ESM on Node)
    files: ['appwrite/*.mjs'],
    languageOptions: { sourceType: 'module', globals: nodeGlobals },
  },
  {
    files: ['**/__tests__/**', 'src/test/jest.setup.ts'],
    languageOptions: { globals: jestGlobals },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
