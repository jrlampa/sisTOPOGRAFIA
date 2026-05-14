module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist/', 'coverage/', 'playwright-report/', 'test-results/', 'src/types/supabase.ts'],
  rules: {
    'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-empty-object-type': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'error',
    'no-loss-of-precision': 'error',
    'no-useless-escape': 'error',
    'no-control-regex': 'error',
    'max-lines': ['error', { max: 750, skipBlankLines: true, skipComments: true }],
  },
  overrides: [
    {
      files: ['server/tests/**/*.ts', 'tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'no-loss-of-precision': 'off',
        'max-lines': 'off',
      },
    },
  ],
};
