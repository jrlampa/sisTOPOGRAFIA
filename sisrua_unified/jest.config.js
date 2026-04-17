export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/server"],
  testMatch: ["**/server/tests/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@google-cloud/firestore|@google-cloud/tasks)/)",
  ],
  collectCoverageFrom: [
    "server/**/*.ts",
    "!server/**/*.d.ts",
    "!server/**/*.test.ts",
    "!server/index.ts",
    // Exclude Firestore-specific services (cloud-only, not unit-testable)
    "!server/services/cacheServiceFirestore.ts",
    "!server/services/firestoreService.ts",
    "!server/services/jobStatusServiceFirestore.ts",
    "!server/services/cqtRuntimeSnapshotService.ts",
    // Exclude Cloud Tasks service (Google Cloud infra only)
    "!server/services/cloudTasksService.ts",
    // Exclude dead-code / rarely-used external-only services
    "!server/services/ollamaService.ts",
    "!server/services/indeService.ts",
    // Exclude BT export history (requires live Postgres, not unit-testable in isolation)
    "!server/services/btExportHistoryService.ts",
    // Exclude Swagger config files (pure type config, no logic)
    "!server/swagger/**/*.ts",
    // Exclude debug/standalone scripts
    "!server/utils/logger.ts",
  ],
  coveragePathIgnorePatterns: ["/node_modules/", "/tests/", "/dist/"],
  coverageThreshold: {
    global: {
      branches: 54,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/server/tests/setup.ts"],
  coverageDirectory: "./coverage/backend",
  globals: {
    "ts-jest": {
      tsconfig: {
        // Force CommonJS output — tsconfig.server.json uses NodeNext which emits ESM
        module: "CommonJS",
        moduleResolution: "node",
        esModuleInterop: true,
        types: ["node", "jest"],
      },
    },
  },
};
