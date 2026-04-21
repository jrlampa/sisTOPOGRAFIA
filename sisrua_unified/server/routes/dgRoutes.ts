/**
 * Design Generativo – Rotas da API
 *
 * POST /api/dg/optimize             – executa otimização DG
 * GET  /api/dg/runs/:id             – placeholder para persistência futura
 * GET  /api/dg/runs/:id/recommendation – retorna apenas a recomendação
 *
 * Feature flag: DG_ENABLED (env var, default true em dev).
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { runDgOptimization } from "../services/dgOptimizationService.js";
import { permissionHandler } from "../middleware/permissionHandler";
import { schemaValidator } from "../middleware/schemaValidator";
import {
  validateBufferZone,
  validateMultiplePoints,
} from "../services/dgBufferValidationService";
import {
  validateBufferZoneRequestSchema,
  validateMultiplePointsRequestSchema,
} from "../schemas/dgBufferValidation";

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
  clients: z.number().int().nonnegative().optional(),
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
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      }),
    )
    .min(3),
  label: z.string().optional(),
});

const corridorSchema = z.object({
  id: z.string().min(1),
  centerPoints: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      }),
    )
    .min(2),
  bufferMeters: z.number().positive(),
  label: z.string().optional(),
});

const weightsSchema = z.object({
  cableCost: z.number().min(0).max(1).optional(),
  poleCost: z.number().min(0).max(1).optional(),
  trafoCost: z.number().min(0).max(1).optional(),
  cqtPenalty: z.number().min(0).max(1).optional(),
  overloadPenalty: z.number().min(0).max(1).optional(),
});

const paramsSchema = z.object({
  maxSpanMeters: z.number().positive().max(100).optional(),
  cqtLimitFraction: z.number().positive().max(0.15).optional(),
  trafoMaxUtilization: z.number().positive().max(1).optional(),
  searchMode: z.enum(["exhaustive", "heuristic"]).optional(),
  allowNewPoles: z.boolean().optional(),
  gridSpacingMeters: z.number().positive().optional(),
  objectiveWeights: weightsSchema.optional(),
});

const optimizeBodySchema = z.object({
  runId: z.string().uuid().optional(),
  poles: z.array(poleInputSchema).min(1).max(500),
  transformer: transformerInputSchema,
  exclusionPolygons: z.array(polygonSchema).optional(),
  roadCorridors: z.array(corridorSchema).optional(),
  params: paramsSchema.optional(),
});

// ─── POST /api/dg/optimize ────────────────────────────────────────────────────

router.post("/optimize", async (req: Request, res: Response) => {
  const parsed = optimizeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Parâmetros inválidos",
      details: parsed.error.flatten(),
    });
  }

  try {
    const output = await runDgOptimization(
      parsed.data as Parameters<typeof runDgOptimization>[0],
    );
    return res.status(200).json(output);
  } catch (err) {
    logger.error("DG optimize error", { message: (err as Error).message });
    if ((err as Error).message.startsWith("DG:")) {
      return res.status(422).json({ error: (err as Error).message });
    }
    return res
      .status(500)
      .json({ error: "Erro interno ao executar otimização DG." });
  }
});

// ─── GET /api/dg/runs/:id ─────────────────────────────────────────────────────

router.get("/runs/:id", (req: Request, res: Response) => {
  // Placeholder – persistência em dg_runs (DB) a implementar
  return res.status(404).json({
    error:
      "Persistência de runs DG ainda não implementada. Use POST /optimize.",
  });
});

// ─── GET /api/dg/runs/:id/recommendation ─────────────────────────────────────

router.get("/runs/:id/recommendation", (req: Request, res: Response) => {
  return res.status(404).json({
    error:
      "Persistência de runs DG ainda não implementada. Use POST /optimize.",
  });
});

// ─── BUFFER ZONE VALIDATION ROUTES ────────────────────────────────────────────

/**
 * POST /api/dg/validate-buffer-zone
 * Validate a single candidate point against street buffer zones and buildings
 */
router.post(
  "/validate-buffer-zone",
  permissionHandler(["READ_DESIGN_GENERATIVO"]),
  schemaValidator(validateBufferZoneRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = req.body;

      logger.info("Buffer zone validation requested", {
        userId: res.locals.userId,
        tenantId: res.locals.tenantId,
        pointLat: request.candidatePoint.latitude,
        pointLon: request.candidatePoint.longitude,
        streetPolylineCount: request.streetPolylines.length,
        buildingCount: request.buildingFootprints?.length || 0,
      });

      const result = await validateBufferZone(request);

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          userId: res.locals.userId,
        },
      });
    } catch (error) {
      logger.error("Error in buffer zone validation endpoint", { error });
      next(error);
    }
  }
);

/**
 * POST /api/dg/validate-batch
 * Validate multiple candidate points in batch
 */
router.post(
  "/validate-batch",
  permissionHandler(["READ_DESIGN_GENERATIVO"]),
  schemaValidator(validateMultiplePointsRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = req.body;

      logger.info("Batch buffer validation requested", {
        userId: res.locals.userId,
        tenantId: res.locals.tenantId,
        pointCount: request.candidatePoints.length,
        streetPolylineCount: request.streetPolylines.length,
        buildingCount: request.buildingFootprints?.length || 0,
      });

      const result = await validateMultiplePoints(request);

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          userId: res.locals.userId,
          acceptanceRatePercent: `${(result.acceptanceRate * 100).toFixed(
            1
          )}%`,
        },
      });
    } catch (error) {
      logger.error("Error in batch buffer validation endpoint", { error });
      next(error);
    }
  }
);

/**
 * GET /api/dg/buffer-config
 * Get recommended buffer configurations by street type
 */
router.get(
  "/buffer-config",
  permissionHandler(["READ_DESIGN_GENERATIVO"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bufferConfigurations = {
        primary_curb: {
          type: "primary",
          minMeters: 0.3,
          maxMeters: 0.5,
          description: "Preferred: 0.3-0.5m from street curb edge",
          applicability: "When precise curb data is available from INDE",
        },
        fallback_centerline: {
          type: "fallback",
          minMeters: 0.5,
          maxMeters: 2.0,
          description: "Fallback: 0.5-2.0m from street centerline",
          applicability: "When only OSM centerline data is available",
        },
        strict_constraint: {
          type: "primary",
          minMeters: 0.2,
          maxMeters: 0.3,
          description: "Strict: 0.2-0.3m from curb (high precision)",
          applicability: "Urban dense areas with precise requirements",
        },
      };

      res.status(200).json({
        success: true,
        data: bufferConfigurations,
        metadata: {
          standardApproach: "primary_curb",
          fallbackApproach: "fallback_centerline",
          specification: "DG_IMPLEMENTATION_ADDENDUM_2026.md",
        },
      });
    } catch (error) {
      logger.error("Error in buffer config endpoint", { error });
      next(error);
    }
  }
);

export default router;
