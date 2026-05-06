import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    setupFiles: ['server/tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts'],
      exclude: [
        'server/**/*.d.ts',
        'server/**/*.test.ts',
        'server/index.ts',
        'server/services/cacheServiceFirestore.ts',
        'server/services/firestoreService.ts',
        'server/services/jobStatusServiceFirestore.ts',
        'server/services/cqtRuntimeSnapshotService.ts',
        'server/services/cloudTasksService.ts',
        'server/services/ollamaService.ts',
        'server/services/indeService.ts',
        'server/services/btExportHistoryService.ts',
        'server/swagger/**/*.ts',
        'server/utils/logger.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      }
    },
  },
});
