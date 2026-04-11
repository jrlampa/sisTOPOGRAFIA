export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/server/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/**/*.test.ts',
    '!server/index.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: [
    '<rootDir>/server/tests/setup.ts',
  ],
  coverageDirectory: './coverage/backend',
  globals: {
    'ts-jest': {
      tsconfig: {
        // Force CommonJS output — tsconfig.server.json uses NodeNext which emits ESM
        module: 'CommonJS',
        moduleResolution: 'node',
        esModuleInterop: true,
        types: ['node', 'jest'],
      },
    },
  },
};
