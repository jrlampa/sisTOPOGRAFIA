import { Router, Request, Response, NextFunction } from "express";
import { schemaValidator } from "../middleware/schemaValidator.js";
import { permissionHandler } from "../middleware/permissionHandler.js";
import { logger } from "../utils/logger.js";
import {
  validateBufferZone,
  validateMultiplePoints,
} from "../services/dgBufferValidationService.js";
import {
  validateBufferZoneRequestSchema,
  validateMultiplePointsRequestSchema,
} from "../schemas/dgBufferValidation.js";

/**
 * Design Generativo Buffer Validation Routes
 *
 * Provides endpoints for validating candidate pole positions against street buffers
 * and building exclusion zones in preparation for automated network design.
 *
 * Access: READ_DESIGN_GENERATIVO permission
 */

const router = Router();

/**
 * POST /api/dg/validate-buffer-zone
 *
 * Validate a single candidate point against street buffer zones and buildings
 *
 * Request body:
 * - candidatePoint: { latitude, longitude }
 * - streetPolylines: Array of OSM LineString geometries
 * - buildingFootprints: Array of building Polygon geometries (optional)
 * - bufferConfig: { type, minMeters, maxMeters } (optional)
 * - networkIsNewGreenfield: boolean (default: false)
 *
 * Response: BufferValidationResult
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
  },
);

/**
 * POST /api/dg/validate-batch
 *
 * Validate multiple candidate points in batch
 *
 * Request body:
 * - candidatePoints: Array of { id?, latitude, longitude }
 * - streetPolylines: Array of OSM LineString geometries
 * - buildingFootprints: Array of building Polygon geometries (optional)
 * - bufferConfig: { type, minMeters, maxMeters } (optional)
 * - networkIsNewGreenfield: boolean (default: false)
 *
 * Response: BatchValidationResult with acceptance rate and recommendations
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
          acceptanceRatePercent: `${(result.acceptanceRate * 100).toFixed(1)}%`,
        },
      });
    } catch (error) {
      logger.error("Error in batch buffer validation endpoint", { error });
      next(error);
    }
  },
);

/**
 * GET /api/dg/buffer-config
 *
 * Get recommended buffer configurations by street type
 *
 * Response: Object with buffer configs for different scenarios
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
  },
);

/**
 * POST /api/dg/validate-with-constraints
 *
 * Validate buffer zones AND additional engineering constraints
 * (Placeholder for future integration with btTelescopicAnalysis, etc.)
 *
 * This endpoint chains multiple validators:
 * 1. Buffer zone validation
 * 2. CQT voltage drop constraints
 * 3. Transformer capacity constraints
 * 4. Radial network topology preservation
 */
router.post(
  "/validate-with-constraints",
  permissionHandler(["READ_DESIGN_GENERATIVO"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(501).json({
        success: false,
        error: "Not Implemented",
        message:
          "Multi-constraint validation coming in Phase 2 of DG implementation",
        roadmapReference: "DG_IMPLEMENTATION_ADDENDUM_2026.md - Frente 3",
      });
    } catch (error) {
      logger.error("Error in multi-constraint validation endpoint", { error });
      next(error);
    }
  },
);

export { router as dgBufferValidationRoutes };
