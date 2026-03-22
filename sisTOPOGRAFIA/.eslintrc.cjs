/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'py_engine', 'e2e', 'scripts'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  rules: {
    // Allow type-only exports alongside component default exports (e.g. Toast + ToastType)
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Disabled for now – large number of pre-existing instances across server code.
    // Re-enable per-file as `any` types are progressively replaced.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    // Disable require() check – Jest test files use CommonJS dynamic requires
    '@typescript-eslint/no-var-requires': 'off',
    // @ts-ignore is used in legacy Leaflet interop; address separately
    '@typescript-eslint/ban-ts-comment': 'off',
  },
};
