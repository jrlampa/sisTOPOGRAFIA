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
 */
export function setupGracefulShutdown(server: Server) {
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop background services
    try {
      stopTaskWorker();
      stopDxfCleanup();
      OllamaService.stopProcess();
      stopFirestoreMonitoring();
      maintenanceService.stop();
      logger.info("[Shutdown] Background services stopped.");
    } catch (err) {
      logger.warn("[Shutdown] Error stopping background services:", err);
    }

    // 2. Stop accepting new connections
    server.close(() => {
      logger.info("[Shutdown] HTTP server closed.");
    });

    // 3. Give active requests time to finish (max 10s)
    const timeout = setTimeout(() => {
      logger.error("[Shutdown] Could not close connections in time, forceful shutdown.");
      process.exit(1);
    }, 10000);

    try {
      // 4. Close DB connections
      await closeDbClient();
      logger.info("[Shutdown] Database connections closed.");

      clearTimeout(timeout);
      logger.info("[Shutdown] Graceful shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error("[Shutdown] Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
