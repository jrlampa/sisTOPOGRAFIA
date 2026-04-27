import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { createDxfTask } from "../services/cloudTasksService.js";
import {
  createCacheKey,
  deleteCachedFilename,
  getCachedFilename,
} from "../services/cacheService.js";
import { logger } from "../utils/logger.js";
import { dxfRequestSchema } from "../schemas/dxfRequest.js";
import { batchRowSchema } from "../schemas/apiSchemas.js";
import { dxfRateLimiter } from "../middleware/rateLimiter.js";
import { metricsService } from "../services/metricsService.js";
import { config } from "../config.js";
import { attachCqtSnapshotToBtContext } from "../services/cqtContextService.js";
import { parseBatchFile } from "../services/batchService.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { resolveDxfDirectory } from "../utils/dxfDirectory.js";
import { requirePermission } from "../middleware/permissionHandler.js";
import {
  validateBtTopology,
  type TopologyInput,
} from "../services/topologicalValidator.js";
import {
  getJobDossier,
  listRecentJobs,
  previewFailedTaskSanitation,
  replayFailedTask,
  sanitizeAndReprocessFailedTasks,
} from "../services/jobDossierService.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Servir arquivos DXF gerados (Mover para o topo)
router.get("/downloads/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  const dxfDirectory = resolveDxfDirectory();
  const filePath = path.join(dxfDirectory, filename);

  logger.info("Tentativa de download de DXF", { filename, filePath });

  if (fs.existsSync(filePath)) {
    // Forçar download binário
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Description", "File Transfer");
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    return res.sendFile(filePath);
  } else {
    logger.warn("Arquivo não encontrado para download", { filename, filePath });
    return res
      .status(404)
      .json({ error: "Arquivo não encontrado ou expirado" });
  }
});

// ─── Input Validation Schemas ────────────────────────────────────────────

// Protocol normalization: ensure only 'http' or 'https'
const protocolSchema = z
  .string()
  .transform((v) => v.split(",")[0].trim().toLowerCase())
  .refine((v) => v === "http" || v === "https", {
    message: 'Protocol must be "http" or "https"',
  });

// CQT summary extraction from btContext with full type safety
const cqtSummarySchema = z
  .object({
    scenario: z.string().optional(),
    dmdi: z.number().optional(),
    p31: z.number().optional(),
    p32: z.number().optional(),
    k10QtMttr: z.number().optional(),
    parityStatus: z.string().optional(),
    parityPassed: z.number().optional(),
    parityFailed: z.number().optional(),
  })
  .nullish();

// File upload validation: MIME type and buffer size
const batchFileSchema = z
  .object({
    buffer: z
      .instanceof(Buffer)
      .refine((buf) => buf.byteLength > 0, { message: "File is empty" })
      .refine((buf) => buf.byteLength <= 50 * 1024 * 1024, {
        message: "File exceeds 50MB limit",
      }),
    mimetype: z
      .string()
      .refine(
        (mime) =>
          [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ].includes(mime),
        { message: "Invalid file type. Allowed: CSV, XLS, XLSX" },
      ),
    originalname: z.string().optional(),
  })
  .strict();

// ────────────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getFallbackBaseUrl = (): string => {
  if (config.APP_PUBLIC_URL) {
    return config.APP_PUBLIC_URL.replace(/\/+$/, "");
  }

  if (config.isDocker && config.NODE_ENV === "development") {
    return "http://localhost:3002";
  }

  if (config.CORS_ORIGIN) {
    const firstOrigin = config.CORS_ORIGIN.split(",")
      .map((entry) => entry.trim())
      .find(Boolean);
    if (firstOrigin) {
      const parsed = safeParseUrl(firstOrigin);
      if (parsed) {
        return parsed.origin;
      }
    }
  }

  return `http://localhost:${config.PORT}`;
};

const buildAllowedHosts = (): Set<string> => {
  const hosts = new Set<string>(DEFAULT_ALLOWED_HOSTS);

  if (config.APP_PUBLIC_URL) {
    const parsed = safeParseUrl(config.APP_PUBLIC_URL);
    if (parsed?.hostname) {
      hosts.add(parsed.hostname.toLowerCase());
    }
  }

  if (config.CORS_ORIGIN) {
    const origins = config.CORS_ORIGIN.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const origin of origins) {
      const parsed = safeParseUrl(origin);
      if (parsed?.hostname) {
        hosts.add(parsed.hostname.toLowerCase());
      }
    }
  }

  return hosts;
};

const ALLOWED_HOSTS = buildAllowedHosts();

const failedTaskSanitationBodySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    dryRun: z.coerce.boolean().optional(),
  })
  .strict();

const normalizeProtocol = (value: unknown): "http" | "https" | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return protocolSchema.parse(value);
  } catch {
    return null;
  }
};

// Exported for focused unit tests.
export function getBaseUrl(req: Request): string {
  if (config.APP_PUBLIC_URL) {
    return config.APP_PUBLIC_URL.replace(/\/+$/, "");
  }

  const hostname = String(req.hostname || "")
    .trim()
    .toLowerCase();
  if (!hostname || !ALLOWED_HOSTS.has(hostname)) {
    const fallback = getFallbackBaseUrl();
    logger.warn("Unsafe host header detected when building DXF download URL", {
      receivedHost: req.headers.host,
      hostname,
      fallback,
    });
    return fallback;
  }

  const protocol =
    normalizeProtocol(req.headers["x-forwarded-proto"]) ||
    normalizeProtocol(req.protocol) ||
    (config.NODE_ENV === "production" ? "https" : "http");

  const hostHeader =
    typeof req.headers.host === "string" ? req.headers.host : "";
  const portMatch = hostHeader.match(/:(\d{1,5})$/);
  const port = portMatch ? Number.parseInt(portMatch[1], 10) : NaN;
  const hasValidPort = Number.isInteger(port) && port >= 1 && port <= 65535;
  const portSegment = hasValidPort ? `:${port}` : "";

  return `${protocol}://${hostname}${portSegment}`;
}

function extractCqtSummary(btContext: unknown): Record<string, unknown> | null {
  if (!btContext || typeof btContext !== "object") {
    return null;
  }

  const context = btContext as Record<string, any>;
  const cqtSnapshotRaw = context.cqtSnapshot;
  if (!cqtSnapshotRaw || typeof cqtSnapshotRaw !== "object") {
    return null;
  }

  const cqtSnapshot = cqtSnapshotRaw as Record<string, any>;
  const parity = cqtSnapshot.parity as Record<string, any> | undefined;

  const summary = {
    scenario:
      typeof cqtSnapshot.scenario === "string"
        ? cqtSnapshot.scenario
        : undefined,
    dmdi:
      typeof cqtSnapshot.dmdi?.dmdi === "number"
        ? cqtSnapshot.dmdi.dmdi
        : undefined,
    p31:
      typeof cqtSnapshot.geral?.p31CqtNoPonto === "number"
        ? cqtSnapshot.geral.p31CqtNoPonto
        : undefined,
    p32:
      typeof cqtSnapshot.geral?.p32CqtNoPonto === "number"
        ? cqtSnapshot.geral.p32CqtNoPonto
        : undefined,
    k10QtMttr:
      typeof cqtSnapshot.db?.k10QtMttr === "number"
        ? cqtSnapshot.db.k10QtMttr
        : undefined,
    parityStatus:
      typeof parity?.referenceStatus === "string"
        ? parity.referenceStatus
        : undefined,
    parityPassed:
      typeof parity?.passed === "number" ? parity.passed : undefined,
    parityFailed:
      typeof parity?.failed === "number" ? parity.failed : undefined,
  };

  // Validate extracted summary against schema
  try {
    return cqtSummarySchema.parse(summary) ?? null;
  } catch {
    return null;
  }
}

function buildDxfRequestSource(req: Request): {
  endpoint: string;
  requestId?: string;
  source: string;
  ip?: string;
  userAgent?: string;
  queuedAt: string;
} {
  const requestId =
    typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"].trim()
      : undefined;
  const endpoint =
    `${req.method.toUpperCase()} ${req.baseUrl || ""}${req.path || ""}`.trim();
  const sourceHeader =
    typeof req.headers["x-client-source"] === "string"
      ? req.headers["x-client-source"].trim()
      : "";

  return {
    endpoint,
    ...(requestId ? { requestId } : {}),
    source: sourceHeader.length > 0 ? sourceHeader : endpoint,
    ...(typeof req.ip === "string" && req.ip.length > 0 ? { ip: req.ip } : {}),
    ...(typeof req.headers["user-agent"] === "string"
      ? { userAgent: req.headers["user-agent"] }
      : {}),
    queuedAt: new Date().toISOString(),
  };
}

// DXF Generation Endpoint
router.post(
  "/",
  dxfRateLimiter,
  requirePermission("export_dxf"),
  async (req: Request, res: Response) => {
    try {
      const requestSource = buildDxfRequestSource(req);
      const validation = dxfRequestSchema.safeParse(req.body);
      if (!validation.success) {
        logger.warn("DXF validation failed", {
          issues: validation.error.issues,
          ip: req.ip,
          requestSource,
        });
        return res.status(422).json({
          error: "Invalid request body",
          details: validation.error.issues,
        });
      }

      const {
        lat,
        lon,
        radius,
        mode,
        polygon,
        layers,
        projection,
        contourRenderMode,
        btContext: validatedBtContext,
        mtContext: validatedMtContext,
      } = validation.data;

      // ── Item 8 · Validação topológica em tempo real ─────────────────────────
      const rawTopology = (
        validatedBtContext as Record<string, unknown> | undefined | null
      )?.topology as TopologyInput | undefined | null;
      if (rawTopology && typeof rawTopology === "object") {
        const topoResult = validateBtTopology(rawTopology);
        if (!topoResult.valid) {
          logger.warn("Topologia BT inválida — DXF rejeitado", {
            errors: topoResult.errors,
            ip: req.ip,
          });
          return res.status(422).json({
            error: "Topologia BT inválida",
            topologyErrors: topoResult.errors,
            topologyWarnings: topoResult.warnings,
          });
        }
        if (topoResult.warnings.length > 0) {
          logger.info("Topologia BT com avisos (aceita)", {
            warnings: topoResult.warnings,
            ip: req.ip,
          });
        }
      }
      // ───────────────────────────────────────────────────────────────────────

      const btContext = attachCqtSnapshotToBtContext(
        validatedBtContext ?? undefined,
      );
      const cqtSummary = extractCqtSummary(btContext);
      const resolvedContourRenderMode =
        contourRenderMode === "polyline" ? "polyline" : "spline";
      const resolvedMode = mode || "circle";
      const cacheKey = createCacheKey({
        lat,
        lon,
        radius,
        mode: resolvedMode,
        contourRenderMode: resolvedContourRenderMode,
        polygon: typeof polygon === "string" ? polygon : (polygon ?? null),
        layers: layers ?? {},
        btContext: btContext ?? null,
      });

      const cachedFilename = getCachedFilename(cacheKey);
      if (cachedFilename) {
        const dxfDirectory = resolveDxfDirectory();
        const cachedFilePath = path.join(dxfDirectory, cachedFilename);
        if (fs.existsSync(cachedFilePath)) {
          const baseUrl = getBaseUrl(req);
          const cachedUrl = `${baseUrl}/api/dxf/downloads/${cachedFilename}`;
          logger.info("DXF cache hit", {
            cacheKey,
            filename: cachedFilename,
            ip: req.ip,
          });
          metricsService.recordDxfRequest("cache_hit");
          return res.json({
            status: "success",
            message: "DXF Generated",
            url: cachedUrl,
            ...(cqtSummary && { cqtSummary }),
          });
        }
        deleteCachedFilename(cacheKey);
        logger.warn("DXF cache entry missing file", {
          cacheKey,
          filename: cachedFilename,
          ip: req.ip,
        });
      } else {
        logger.info("DXF cache miss", { cacheKey, ip: req.ip });
      }

      const baseUrl = getBaseUrl(req);
      const filename = `dxf_${Date.now()}_${crypto.randomUUID()}.dxf`;
      const dxfDirectory = resolveDxfDirectory();
      fs.mkdirSync(dxfDirectory, { recursive: true });
      const outputFile = path.join(dxfDirectory, filename);
      // Incluindo o prefixo da rota /api/dxf
      const downloadUrl = `${baseUrl}/api/dxf/downloads/${filename}`;

      logger.info("Queueing DXF generation", {
        lat,
        lon,
        radius,
        mode: resolvedMode,
        projection: projection || "local",
        contourRenderMode: resolvedContourRenderMode,
        hasBtContext: !!btContext,
        hasCqtSnapshot: !!(
          btContext &&
          typeof btContext === "object" &&
          "cqtSnapshot" in btContext
        ),
        cacheKey,
        requestSource,
      });

      const { taskId, alreadyCompleted } = await createDxfTask({
        lat,
        lon,
        radius,
        mode: resolvedMode,
        polygon:
          typeof polygon === "string" ? polygon : JSON.stringify(polygon || []),
        layers: layers || {},
        projection: projection || "local",
        contourRenderMode: resolvedContourRenderMode,
        btContext: btContext ?? null,
        mtContext: validatedMtContext ?? null,
        requestMeta: requestSource,
        outputFile,
        filename,
        cacheKey,
        downloadUrl,
      });

      const responseStatus = alreadyCompleted ? "success" : "queued";
      metricsService.recordDxfRequest("generated");
      return res.status(alreadyCompleted ? 200 : 202).json({
        status: responseStatus,
        jobId: taskId,
        ...(cqtSummary && { cqtSummary }),
        ...(alreadyCompleted && {
          url: downloadUrl,
          message: "DXF generated immediately in development mode",
        }),
      });
    } catch (err: unknown) {
      logger.error("DXF generation error", {
        error: err instanceof Error ? err.message : String(err),
        ip: req.ip,
      });
      metricsService.recordDxfRequest("failed");
      return res.status(500).json({ error: "Generation failed" });
    }
  },
);

// Batch DXF Generation via File (CSV or Excel)
router.post(
  "/batch",
  dxfRateLimiter,
  upload.single("csv"),
  requirePermission("export_dxf"),
  async (req: Request, res: Response) => {
    try {
      const requestSource = buildDxfRequestSource(req);
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file MIME type and buffer size
      const fileValidation = batchFileSchema.safeParse({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });

      if (!fileValidation.success) {
        return res.status(400).json({
          error: "Invalid file",
          details: fileValidation.error.issues,
        });
      }

      const rows = await parseBatchFile(req.file.buffer, req.file.mimetype);
      const results = [];
      const errors = [];

      for (const { row, line } of rows) {
        const validation = batchRowSchema.safeParse(row);
        if (!validation.success) {
          errors.push({ line, details: validation.error.issues });
          continue;
        }

        const { lat, lon, radius, mode, name } = validation.data;
        const filename = `batch_${name}_${Date.now()}.dxf`;
        const dxfDirectory = resolveDxfDirectory();
        const outputFile = path.join(dxfDirectory, filename);
        const baseUrl = getBaseUrl(req);
        const downloadUrl = `${baseUrl}/api/dxf/downloads/${filename}`;

        // Generate cache key for batch row (used for potential deduplication)
        const cacheKey = createCacheKey({
          lat,
          lon,
          radius,
          mode: mode || "circle",
          polygon: null,
          layers: {},
          contourRenderMode: "spline",
          btContext: null,
        });

        try {
          const { taskId } = await createDxfTask({
            lat,
            lon,
            radius,
            mode: mode || "circle",
            polygon: "[]",
            layers: {},
            projection: "local",
            contourRenderMode: "spline",
            btContext: null,
            requestMeta: {
              ...requestSource,
              source: `${requestSource.source}|batch:${name}`,
            },
            outputFile,
            filename,
            downloadUrl,
            cacheKey,
          });

          results.push({ name, line, taskId, status: "queued" });
        } catch (err: any) {
          errors.push({ name, line, error: err.message });
        }
      }

      return res.json({
        status: "batch_processed",
        total: rows.length,
        queued: results.length,
        failed: errors.length,
        results,
        errors,
      });
    } catch (err: any) {
      logger.error("Batch DXF processing failed", { error: err.message });
      return res.status(500).json({ error: "Batch processing failed" });
    }
  },
);

// GET /dxf/jobs/failed/sanitation-preview?limit=N — classifica failed por origem/causa
router.get(
  "/jobs/failed/sanitation-preview",
  requirePermission("admin"),
  async (req: Request, res: Response) => {
    try {
      const raw = Number(req.query["limit"] ?? 200);
      const limit = Number.isFinite(raw) ? raw : 200;
      const preview = await previewFailedTaskSanitation(limit);
      return res.json(preview);
    } catch (err) {
      logger.error("Erro na prévia de saneação de tarefas com falha", {
        error: err,
      });
      return res
        .status(500)
        .json({ error: "Falha ao gerar prévia de saneação" });
    }
  },
);

// POST /dxf/jobs/failed/sanitize-reprocess — saneia inválidos e reprocessa elegíveis
router.post(
  "/jobs/failed/sanitize-reprocess",
  requirePermission("admin"),
  async (req: Request, res: Response) => {
    const parsed = failedTaskSanitationBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Payload inválido",
        details: parsed.error.flatten(),
      });
    }

    const limit = parsed.data.limit ?? 200;
    const dryRun = parsed.data.dryRun ?? false;

    if (dryRun) {
      const preview = await previewFailedTaskSanitation(limit);
      return res.json({ dryRun: true, ...preview });
    }

    const result = await sanitizeAndReprocessFailedTasks(limit);
    return res.json(result);
  },
);

// ─── Job Dossier — Item 3: Orquestração Confiável ────────────────────────────

// GET /dxf/jobs?limit=N  — lista jobs recentes (admin ou técnico)
router.get(
  "/jobs",
  requirePermission("export_dxf"),
  async (req: Request, res: Response) => {
    try {
      const raw = Number(req.query["limit"] ?? 50);
      const limit = Number.isFinite(raw) ? raw : 50;
      const jobs = await listRecentJobs(limit);
      return res.json({ total: jobs.length, jobs });
    } catch (err) {
      logger.error("Erro ao listar jobs recentes", { error: err });
      return res.status(500).json({ error: "Falha ao listar jobs" });
    }
  },
);

// GET /dxf/jobs/:taskId  — dossiê completo de um job
router.get(
  "/jobs/:taskId",
  requirePermission("export_dxf"),
  async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const dossier = await getJobDossier(taskId);
    if (!dossier) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }
    return res.json(dossier);
  },
);

// Servir arquivos DXF gerados
router.get("/downloads/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  const dxfDirectory = resolveDxfDirectory();
  const filePath = path.join(dxfDirectory, filename);

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/dxf");
    return res.sendFile(filePath);
  } else {
    logger.warn("Tentativa de download de arquivo inexistente", {
      filename,
      filePath,
    });
    return res
      .status(404)
      .json({ error: "Arquivo não encontrado ou expirado" });
  }
});

// POST /dxf/jobs/:taskId/replay  — replay controlado (somente admin)
router.post(
  "/jobs/:taskId/replay",
  requirePermission("admin"),
  async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const result = await replayFailedTask(taskId);
    const httpStatus = result.replayed ? 200 : 409;
    return res.status(httpStatus).json(result);
  },
);

export default router;
