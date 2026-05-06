module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist/", "coverage/", "playwright-report/", "test-results/"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-empty-object-type": "warn",
    "@typescript-eslint/no-unsafe-function-type": "warn",
    "no-loss-of-precision": "warn",
    "no-useless-escape": "warn",
    "no-control-regex": "warn",
  },
  overrides: [
    {
      files: ["server/tests/**/*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "no-loss-of-precision": "off",
      },
    },
  ],
};
