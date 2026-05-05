/**
 * Design Generativo – Rotas da API
 *
 * POST /api/dg/optimize             – executa otimização DG
 * POST /api/dg/decision             – registra descarte/aceite para auditoria
 * POST /api/dg/accept               – registra aceite de cenário (Auditoria)
 * GET  /api/dg/runs                 – lista runs executadas
 * GET  /api/dg/runs/:id             – detalhe de uma run
 * GET  /api/dg/runs/:id/scenarios   – lista cenários de uma run
 * GET  /api/dg/runs/:id/recommendation – retorna apenas a recomendação
 * GET  /api/dg/discard-rates        – estatísticas de descarte
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import {
  runDgOptimization,
  listDgRuns,
  listDgDiscardRates,
  getDgRun,
  getDgRunScenarios,
  getDgRunRecommendation,
} from "../services/dgOptimizationService.js";
import { planMtRouter } from "../services/dg/dgPartitioner.js";
import { parseKmzToMtRouterInput } from "../services/dg/kmzPreprocessingService.js";
import { logAudit } from "../services/auditLogService.js";
import { permissionHandler } from "../middleware/permissionHandler.js";
import { schemaValidator } from "../middleware/schemaValidator.js";
import {
  validateBufferZone,
  validateMultiplePoints,
} from "../services/dgBufferValidationService.js";
import {
  validateBufferZoneRequestSchema,
  validateMultiplePointsRequestSchema,
} from "../schemas/dgBufferValidation.js";

const router = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const latLonSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const poleInputSchema = z.object({
  id: z.string().min(1),
  position: latLonSchema,
  demandKva: z.number().nonnegative(),
  clients: z.number().int().nonnegative().optional().default(1),
});

const transformerInputSchema = z.object({
  id: z.string().min(1),
  position: latLonSchema,
  kva: z.number().positive(),
  currentDemandKva: z.number().nonnegative().optional(),
});

const polygonSchema = z.object({
  id: z.string().min(1),
  reason: z
    .enum(["building", "restricted_zone", "road_buffer"])
    .optional()
    .default("building"),
  points: z.array(latLonSchema).min(3),
  label: z.string().optional(),
});

const corridorSchema = z.object({
  id: z.string().min(1),
  centerPoints: z.array(latLonSchema).min(2),
  bufferMeters: z.number().positive(),
  label: z.string().optional(),
  highwayClass: z
    .enum([
      "residential",
      "tertiary",
      "secondary",
      "primary",
      "trunk",
      "unknown",
    ])
    .optional(),
});

const weightsSchema = z.object({
  cableCost: z.number().min(0).max(1).optional().default(0.3),
  poleCost: z.number().min(0).max(1).optional().default(0.1),
  trafoCost: z.number().min(0).max(1).optional().default(0.15),
  cqtPenalty: z.number().min(0).max(1).optional().default(0.3),
  overloadPenalty: z.number().min(0).max(1).optional().default(0.15),
});

const paramsSchema = z.object({
  maxSpanMeters: z.number().positive().max(100).optional(),
  cqtLimitFraction: z.number().positive().max(0.15).optional(),
  trafoMaxUtilization: z.number().positive().max(1).optional(),
  searchMode: z.enum(["exhaustive", "heuristic"]).optional(),
  allowNewPoles: z.boolean().optional(),
  maxCandidatesHeuristic: z.number().int().positive().optional(),
  gridSpacingMeters: z.number().positive().optional(),
  objectiveWeights: weightsSchema.optional(),
  projectMode: z.enum(["optimization", "full_project"]).optional(),
  clientesPorPoste: z.number().int().positive().optional(),
  areaClandestinaM2: z.number().nonnegative().optional(),
  demandaMediaClienteKva: z.number().positive().optional(),
  fatorSimultaneidade: z.number().positive().max(1).optional(),
  faixaKvaTrafoPermitida: z.array(z.number().positive()).min(1).optional(),
  trafoMaxKva: z.number().positive().optional(),
});

const optimizeBodySchema = z
  .object({
    runId: z.string().uuid().optional(),
    poles: z.array(poleInputSchema).min(1).max(500),
    transformer: transformerInputSchema.optional(),
    exclusionPolygons: z.array(polygonSchema).optional(),
    roadCorridors: z.array(corridorSchema).optional(),
    params: paramsSchema.optional(),
  })
  .superRefine((body, ctx) => {
    const isFullProject = body.params?.projectMode === "full_project";
    if (!isFullProject && !body.transformer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transformador obrigatório no modo legado.",
        path: ["transformer"],
      });
    }
  });

const mtRouterBodySchema = z.object({
  source: latLonSchema,
  terminals: z
    .array(
      z.object({
        id: z.string().min(1),
        position: latLonSchema,
      }),
    )
    .min(1),
  roadCorridors: z.array(corridorSchema).min(1),
  maxSnapDistanceMeters: z.number().positive().max(1000).optional(),
  nodeMergeThresholdMeters: z.number().nonnegative().max(10).optional(),
  networkProfile: z
    .object({
      conductorId: z.string().min(1),
      structureType: z.string().min(1),
    })
    .optional(),
  existingPoles: z
    .array(
      z.object({
        id: z.string().min(1),
        position: latLonSchema,
      }),
    )
    .optional(),
});

const decisionBodySchema = z.object({
  runId: z.string().uuid(),
  scenarioId: z.string().min(1).optional(),
  appliedMode: z.enum(["all", "trafo_only", "discard"]),
  score: z.number().optional(),
});

// ─── Endpoints ───────────────────────────────────────────────────────────────

router.post(
  "/optimize",
  permissionHandler("WRITE_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    const parsed = optimizeBodySchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Parâmetros inválidos",
          details: parsed.error.flatten(),
        });
    try {
      const output = await runDgOptimization({
        ...parsed.data,
        tenantId: res.locals.tenantId,
      });
      return res.status(200).json(output);
    } catch (err) {
      logger.error("DG optimize error", {
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

router.post(
  "/mt-router",
  permissionHandler("WRITE_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    const parsed = mtRouterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: "Parâmetros inválidos",
          details: parsed.error.flatten(),
        });
    }
    try {
      const result = planMtRouter(parsed.data);
      return res.status(result.feasible ? 200 : 422).json(result);
    } catch (err) {
      logger.error("DG mt-router error", {
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

router.post(
  "/decision",
  permissionHandler("WRITE_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    const parsed = decisionBodySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Parâmetros inválidos" });
    try {
      logAudit({
        userId: res.locals.userId,
        action: "DG_DECISION",
        resource: "dg_run",
        resourceId: parsed.data.runId,
        result: "success",
        details: { ...parsed.data, tenantId: res.locals.tenantId },
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao registrar auditoria." });
    }
  },
);

router.post(
  "/accept",
  permissionHandler("WRITE_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    const parsed = decisionBodySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Parâmetros inválidos" });
    try {
      logAudit({
        userId: res.locals.userId,
        action: "DG_APPLIED",
        resource: "dg_run",
        resourceId: parsed.data.runId,
        result: "success",
        details: { ...parsed.data, tenantId: res.locals.tenantId },
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao registrar auditoria." });
    }
  },
);

router.get(
  "/runs",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
      const runs = await listDgRuns(limit, res.locals.tenantId);
      return res.status(200).json({ total: runs.length, limit, runs });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao listar runs DG." });
    }
  },
);

router.get(
  "/discard-rates",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 200);
      const rates = await listDgDiscardRates(limit, res.locals.tenantId);
      return res.status(200).json({ total: rates.length, limit, rows: rates });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Erro ao listar taxas de descarte DG." });
    }
  },
);

router.get(
  "/runs/:id",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    try {
      const run = await getDgRun(req.params.id, res.locals.tenantId);
      if (!run)
        return res.status(404).json({ error: "Run DG não encontrada." });
      return res.status(200).json(run);
    } catch (err) {
      return res.status(500).json({ error: "Erro ao consultar run." });
    }
  },
);

router.get(
  "/runs/:id/scenarios",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    try {
      const scenarios = await getDgRunScenarios(
        req.params.id,
        res.locals.tenantId,
      );
      if (!scenarios)
        return res.status(404).json({ error: "Run DG não encontrada." });
      const feasibleOnly = req.query.feasibleOnly === "true";
      const filtered = feasibleOnly
        ? scenarios.filter((s) => s.feasible)
        : scenarios;
      return res
        .status(200)
        .json({
          runId: req.params.id,
          total: scenarios.length,
          returned: filtered.length,
          scenarios: filtered,
        });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao consultar cenários." });
    }
  },
);

router.get(
  "/runs/:id/recommendation",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  async (req: Request, res: Response) => {
    try {
      const recommendation = await getDgRunRecommendation(
        req.params.id,
        res.locals.tenantId,
      );
      if (!recommendation)
        return res.status(404).json({ error: "Recomendação não encontrada." });
      return res.status(200).json({ runId: req.params.id, recommendation });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao consultar recomendação." });
    }
  },
);

// ─── KMZ upload (memória, máx 10 MB) ─────────────────────────────────────────

const kmzUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.google-earth.kmz",
      "application/vnd.google-earth.kml+xml",
      "application/zip",
      "application/octet-stream",
      "text/xml",
      "application/xml",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(kmz|kml)$/i)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato de arquivo inválido. Envie um arquivo .kmz ou .kml.",
        ),
      );
    }
  },
});

/**
 * POST /api/dg/mt-router/parse-kmz
 *
 * Recebe upload multipart de um arquivo .kmz ou .kml e retorna os componentes
 * de entrada do MT Router: source, terminals e roadCorridors.
 */
router.post(
  "/mt-router/parse-kmz",
  permissionHandler("WRITE_DESIGN_GENERATIVO"),
  kmzUpload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Arquivo .kmz/.kml não enviado. Use o campo 'file'." });
    }
    try {
      const result = await parseKmzToMtRouterInput(
        req.file.buffer,
        req.file.mimetype,
      );
      return res.status(200).json(result);
    } catch (err) {
      logger.error("DG parse-kmz error", { message: (err as Error).message });
      return res.status(422).json({ error: (err as Error).message });
    }
  },
);

router.post(
  "/validate-buffer-zone",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  schemaValidator(validateBufferZoneRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await validateBufferZone(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ error: "Erro na validação de buffer." });
    }
  },
);

router.post(
  "/validate-batch",
  permissionHandler("READ_DESIGN_GENERATIVO"),
  schemaValidator(validateMultiplePointsRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await validateMultiplePoints(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ error: "Erro na validação batch." });
    }
  },
);

export default router;
