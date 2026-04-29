import { Server } from "node:http";
import { logger } from "./utils/logger.js";
import { closeDbClient } from "./repositories/dbClient.js";
import { stopTaskWorker } from "./services/cloudTasksService.js";
import { stopDxfCleanup } from "./services/dxfCleanupService.js";
import { OllamaService } from "./services/ollamaService.js";
import { stopFirestoreMonitoring } from "./services/firestoreService.js";
import { maintenanceService } from "./services/maintenanceService.js";

/**
 * Gracefully shuts down the server and its dependencies.
 * Handles SIGTERM and SIGINT signals.
 * Roadmap Item P1.4 [T1]: Graceful Shutdown (SIGTERM Handler).
 */
export function setupGracefulShutdown(server: Server) {
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    // Give active requests and workers time to finish (max 25s for Cloud Run)
    const timeout = setTimeout(() => {
      logger.error("[Shutdown] Could not close connections in time, forceful shutdown.");
      process.exit(1);
    }, 25000);

    // 1. Stop background services with drainage
    try {
      await stopTaskWorker();
      stopDxfCleanup();
      OllamaService.stopProcess();
      stopFirestoreMonitoring();
      maintenanceService.stop();
      logger.info("[Shutdown] All background services stopped and drained.");
    } catch (err) {
      logger.warn("[Shutdown] Error stopping background services:", err);
    }

    // 2. Stop accepting new connections
    server.close(() => {
      logger.info("[Shutdown] HTTP server closed.");
    });

    try {
      // 3. Close DB connections
      await closeDbClient();
      logger.info("[Shutdown] Database connections closed.");

      clearTimeout(timeout);
      logger.info("[Shutdown] Graceful shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error("[Shutdown] Error during final stage of shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
