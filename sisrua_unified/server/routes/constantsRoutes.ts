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
import { createListQuerySchema } from "../schemas/apiSchemas.js";
import { buildListMeta } from "../utils/listing.js";
import { requirePermission } from "../middleware/permissionHandler.js";
import {
  extractCorrelationIds,
  formatCorrelationSuffix,
} from "../utils/correlationIds.js";

const router = Router();

const refreshEventsQuerySchema = createListQuerySchema(
  {
    defaultLimit: 20,
    maxLimit: 100,
    sortBy: ["createdAt", "actor", "httpStatus", "durationMs", "success"],
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
  },
  {
    actor: z.string().trim().min(1).optional(),
    namespace: z.string().trim().min(1).optional(),
    success: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  },
);

const snapshotsQuerySchema = createListQuerySchema(
  {
    defaultLimit: 20,
    maxLimit: 100,
    sortBy: ["createdAt", "namespace", "actor", "entryCount"],
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
  },
  {
    namespace: z.string().trim().min(1).optional(),
    actor: z.string().trim().min(1).optional(),
  },
);

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
  const baseActor = req.get("x-refresh-actor") || req.ip || "unknown";
  const correlation = extractCorrelationIds(req);
  return `${baseActor}${formatCorrelationSuffix(correlation)}`;
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
    return res.status(400).json({
      error: "Invalid query parameters",
      details: validation.error.issues,
    });
  }

  const { limit, offset, sortBy, sortOrder, actor, namespace, success } =
    validation.data;
  const result = await constantsService.getRefreshEvents({
    limit,
    offset,
    sortBy: sortBy as
      | "createdAt"
      | "actor"
      | "httpStatus"
      | "durationMs"
      | "success",
    sortOrder,
    filters: {
      actor,
      namespace,
      success,
    },
  });

  return res.json({
    events: result.events,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    meta: buildListMeta({
      limit: result.limit,
      offset: result.offset,
      total: result.total,
      returned: result.events.length,
      sortBy,
      sortOrder,
      filters: {
        actor: actor ?? null,
        namespace: namespace ?? null,
        success: typeof success === "boolean" ? success : null,
      },
    }),
  });
});

router.post(
  "/refresh",
  requirePermission("admin"),
  async (req: Request, res: Response) => {
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
  },
);

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
    return res.status(400).json({
      error: "Invalid query parameters",
      details: validation.error.issues,
    });
  }

  const { limit, offset, sortBy, sortOrder, namespace, actor } =
    validation.data;
  const result = await constantsService.listSnapshots({
    limit,
    offset,
    sortBy: sortBy as "createdAt" | "namespace" | "actor" | "entryCount",
    sortOrder,
    filters: {
      namespace,
      actor,
    },
  });

  return res.json({
    snapshots: result.snapshots,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    meta: buildListMeta({
      limit: result.limit,
      offset: result.offset,
      total: result.total,
      returned: result.snapshots.length,
      sortBy,
      sortOrder,
      filters: {
        namespace: namespace ?? null,
        actor: actor ?? null,
      },
    }),
  });
});

router.post(
  "/snapshots/:id/restore",
  requirePermission("admin"),
  async (req: Request, res: Response) => {
    if (!isRefreshAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized restore request" });
    }

    const validation = snapshotRestoreParamsSchema.safeParse(req.params);
    if (!validation.success) {
      return res
        .status(400)
        .json({
          error: "Invalid snapshot id",
          details: validation.error.issues,
        });
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
  },
);

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
