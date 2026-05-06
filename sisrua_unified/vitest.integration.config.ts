import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/tests/**/*.integration.test.ts"],
    setupFiles: ["server/tests/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
    coverage: {
      enabled: false,
    },
  },
});
