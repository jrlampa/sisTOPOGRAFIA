import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/hooks/useMapState.risk.test.ts",
      "tests/hooks/useBtExportHistory.risk.test.ts",
      "tests/hooks/useDxfExport.test.ts",
      "tests/services/geminiService.test.ts",
      "tests/services/dxfService.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "text-summary"],
      reportsDirectory: "coverage/frontend-risk",
      all: true,
      include: [
        "src/hooks/useMapState.ts",
        "src/hooks/useBtExportHistory.ts",
        "src/hooks/useDxfExport.ts",
        "src/services/geminiService.ts",
        "src/services/dxfService.ts",
      ],
      thresholds: {
        lines: 55,
        functions: 28,
        branches: 34,
        statements: 55,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
