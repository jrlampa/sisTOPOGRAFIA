import "dotenv/config";
import fs from "fs";
import { config } from "./config.js";
import app from "./app.js";
import { OllamaService } from "./services/ollamaService.js";
import {
  startFirestoreMonitoring,
  stopFirestoreMonitoring,
} from "./services/firestoreService.js";
import {
  initializeDxfCleanup,
  stopDxfCleanup,
} from "./services/dxfCleanupService.js";
import { stopTaskWorker } from "./services/cloudTasksService.js";
import { constantsService } from "./services/constantsService.js";
import { maintenanceService } from "./services/maintenanceService.js";
import { logger } from "./utils/logger.js";
import { refreshRateLimitersFromCatalog } from "./middleware/rateLimiter.js";
import { initDbClient } from "./repositories/index.js";

const port = config.PORT;
const dxfDirectory = config.DXF_DIRECTORY;

// Ensure DXF directory exists
if (!fs.existsSync(dxfDirectory)) {
  fs.mkdirSync(dxfDirectory, { recursive: true });
}

// Start server
const server = app.listen(port, async () => {
  logger.info("Backend online", {
    service: "sisRUA",
    version: config.APP_VERSION,
    port,
  });

  // Initialise shared PostgreSQL connection pool
  await initDbClient();

  if (config.useSupabaseJobs) {
    logger.info("Supabase/Postgres jobs persistence is enabled");
  }

  const dbConstantsNamespaces: string[] = [
    ...(config.useDbConstantsCqt ? ["cqt"] : []),
    ...(config.useDbConstantsClandestino ? ["clandestino"] : []),
    ...(config.useDbConstantsConfig ? ["config"] : []),
  ];

  if (dbConstantsNamespaces.length > 0) {
    await constantsService.warmUp(dbConstantsNamespaces).catch((e: Error) =>
      logger.warn("Constants warmup failed — hardcoded fallback active", {
        error: e.message,
      }),
    );
    refreshRateLimitersFromCatalog();
  }

  initializeDxfCleanup(dxfDirectory);
  maintenanceService.start();

  if (config.NODE_ENV === "production" && config.useFirestore) {
    await startFirestoreMonitoring().catch((e) =>
      logger.error("Firestore monitor failed", e),
    );
  }

  // Start Ollama process management
  await OllamaService.startProcess();
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info("Graceful shutdown initiated...");
  stopTaskWorker();
  stopDxfCleanup();
  OllamaService.stopProcess();
  stopFirestoreMonitoring();
  maintenanceService.stop();
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export default server;
