import { Router, Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import {
  getRateLimitPolicySnapshot,
  refreshRateLimitersFromCatalog,
} from "../middleware/rateLimiter.js";
import { constantsService } from "../services/constantsService.js";
import { getDxfCleanupPolicySnapshot } from "../services/dxfCleanupService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { listQueryBaseSchema } from "../schemas/apiSchemas.js";
import { requirePermission } from "../middleware/permissionHandler.js";

const router = Router();

const refreshEventsQuerySchema = listQueryBaseSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const snapshotsQuerySchema = listQueryBaseSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  namespace: z.string().trim().min(1).optional(),
});

const snapshotRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
};

const getDbConstantsNamespaces = (): string[] => [
  ...(config.useDbConstantsCqt ? ["cqt"] : []),
  ...(config.useDbConstantsClandestino ? ["clandestino"] : []),
  ...(config.useDbConstantsConfig ? ["config"] : []),
];

const isRefreshAuthorized = (req: Request): boolean => {
  const expectedToken = config.CONSTANTS_REFRESH_TOKEN?.trim();
  if (!expectedToken) {
    return false;
  }

  const receivedToken = req.get("x-constants-refresh-token") || "";
  const expectedBuf = Buffer.from(expectedToken);
  const receivedBuf = Buffer.from(receivedToken);

  // timingSafeEqual requires equal-length buffers.
  // When lengths differ, compare against a zero-filled dummy buffer of the
  // same length as expectedBuf to keep timing consistent, then return false.
  if (expectedBuf.length !== receivedBuf.length) {
    crypto.timingSafeEqual(expectedBuf, Buffer.alloc(expectedBuf.length));
    return false;
  }

  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
};

const getRefreshActor = (req: Request): string => {
  return req.get("x-refresh-actor") || req.ip || "unknown";
};

router.get("/status", async (req: Request, res: Response) => {
  if (!isRefreshAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized status request" });
  }

  const lastRefreshEvent = await constantsService.getLastRefreshEvent();

  return res.json({
    flags: {
      cqt: config.useDbConstantsCqt,
      clandestino: config.useDbConstantsClandestino,
      config: config.useDbConstantsConfig,
    },
    cache: constantsService.stats(),
    rateLimitPolicy: getRateLimitPolicySnapshot(),
    dxfCleanupPolicy: getDxfCleanupPolicySnapshot(),
    lastRefreshEvent,
  });
});

router.get("/refresh-events", async (req: Request, res: Response) => {
  if (!isRefreshAuthorized(req)) {
    return res
      .status(401)
      .json({ error: "Unauthorized refresh events request" });
  }

  const validation = refreshEventsQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res
      .status(400)
      .json({
        error: "Invalid query parameters",
        details: validation.error.issues,
      });
  }

  const { limit, offset } = validation.data;
  const events = await constantsService.getRefreshEvents(limit, offset);

  return res.json({ events, limit: Math.max(1, Math.min(limit, 100)), offset });
});

router.post("/refresh", requirePermission("admin"), async (req: Request, res: Response) => {
  const actor = getRefreshActor(req);
  const startedAt = Date.now();

  if (!isRefreshAuthorized(req)) {
    await constantsService.recordRefreshEvent({
      namespaces: [],
      success: false,
      httpStatus: 401,
      actor,
      durationMs: Date.now() - startedAt,
      errorMessage: "unauthorized",
    });
    return res.status(401).json({ error: "Unauthorized refresh request" });
  }

  const namespaces = getDbConstantsNamespaces();
  if (namespaces.length === 0) {
    await constantsService.recordRefreshEvent({
      namespaces,
      success: false,
      httpStatus: 400,
      actor,
      durationMs: Date.now() - startedAt,
      errorMessage: "no_enabled_namespaces",
    });
    return res
      .status(400)
      .json({ error: "No DB constants namespace is enabled" });
  }

  try {
    await constantsService.warmUp(namespaces);
    refreshRateLimitersFromCatalog();
    await constantsService.recordRefreshEvent({
      namespaces,
      success: true,
      httpStatus: 200,
      actor,
      durationMs: Date.now() - startedAt,
    });

    // Capture cache snapshot immediately after successful refresh so
    // operators can roll back to this state later.
    const snapshots = await constantsService.saveSnapshot(namespaces, actor);

    return res.json({
      ok: true,
      refreshedNamespaces: namespaces,
      snapshotIds: snapshots.map((s) => s.id),
      cache: constantsService.stats(),
      rateLimitPolicy: getRateLimitPolicySnapshot(),
      dxfCleanupPolicy: getDxfCleanupPolicySnapshot(),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await constantsService.recordRefreshEvent({
      namespaces,
      success: false,
      httpStatus: 500,
      actor,
      durationMs: Date.now() - startedAt,
      errorMessage,
    });
    logger.warn("Manual constants refresh failed", {
      error: errorMessage,
      namespaces,
    });
    return res.status(500).json({ error: "Manual constants refresh failed" });
  }
});

router.get("/refresh-stats", async (req: Request, res: Response) => {
  if (!isRefreshAuthorized(req)) {
    return res
      .status(401)
      .json({ error: "Unauthorized refresh stats request" });
  }

  const stats = await constantsService.getRefreshStats();
  return res.json(stats);
});

router.get("/snapshots", async (req: Request, res: Response) => {
  if (!isRefreshAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized snapshots request" });
  }

  const validation = snapshotsQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res
      .status(400)
      .json({
        error: "Invalid query parameters",
        details: validation.error.issues,
      });
  }

  const { limit, offset, namespace } = validation.data;
  const snapshots = await constantsService.listSnapshots(limit, offset, namespace);

  return res.json({ snapshots, limit: Math.max(1, Math.min(limit, 100)), offset });
});

router.post("/snapshots/:id/restore", requirePermission("admin"), async (req: Request, res: Response) => {
  if (!isRefreshAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized restore request" });
  }

  const validation = snapshotRestoreParamsSchema.safeParse(req.params);
  if (!validation.success) {
    return res
      .status(400)
      .json({ error: "Invalid snapshot id", details: validation.error.issues });
  }

  const actor = getRefreshActor(req);
  const snapshot = await constantsService.restoreSnapshot(validation.data.id);

  if (!snapshot) {
    return res
      .status(404)
      .json({ error: `Snapshot ${validation.data.id} not found` });
  }

  logger.info("Snapshot restore applied by operator", {
    snapshotId: validation.data.id,
    actor,
  });

  return res.json({
    ok: true,
    restoredSnapshotId: snapshot.id,
    namespace: snapshot.namespace,
    entryCount: snapshot.entryCount,
    snapshotCreatedAt: snapshot.createdAt,
    cache: constantsService.stats(),
  });
});

const clandestineQuerySchema = z.object({}).strict();

router.get("/clandestino", (req: Request, res: Response) => {
  const validation = clandestineQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: validation.error.issues,
    });
  }

  if (!config.useDbConstantsClandestino) {
    return res
      .status(404)
      .json({ error: "DB-backed clandestino constants are disabled" });
  }

  try {
    const areaToKva = constantsService.getSync<Record<string, number>>(
      "clandestino",
      "AREA_TO_KVA",
    );
    const clientToDiversifFactor = constantsService.getSync<
      Record<string, number>
    >("clandestino", "CLIENT_TO_DIVERSIF_FACTOR");

    if (!isNumberRecord(areaToKva) || !isNumberRecord(clientToDiversifFactor)) {
      return res
        .status(503)
        .json({ error: "Clandestino constants catalog is not ready" });
    }

    return res.json({ areaToKva, clientToDiversifFactor });
  } catch (err: unknown) {
    logger.warn("Failed to serve clandestino constants", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res
      .status(500)
      .json({ error: "Failed to load clandestino constants" });
  }
});

export default router;
