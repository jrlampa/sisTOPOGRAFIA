import { Router, Request, Response } from "express";
import { IndeService } from "../services/indeService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

const router = Router();
const INDE_INTERNAL_ERROR_RESPONSE = {
  error: "INDE service temporarily unavailable",
};

const VALID_SOURCES = ["ibge", "icmbio", "ana", "dnit"] as const;
const sourceParamSchema = z.object({
  source: z.enum(VALID_SOURCES),
});

const bboxQueryObjectSchema = z.object({
  layer: z.string().trim().min(1),
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
});

const featuresQuerySchema = bboxQueryObjectSchema
  .extend({
    limit: z.coerce.number().int().min(1).max(5000).default(1000),
  })
  .refine((data) => data.west < data.east && data.south < data.north, {
    message: "Invalid bounding box. Expected west<east and south<north.",
  });

const wmsQuerySchema = bboxQueryObjectSchema
  .extend({
    width: z.coerce.number().int().min(64).max(4096).default(1024),
    height: z.coerce.number().int().min(64).max(4096).default(768),
  })
  .refine((data) => data.west < data.east && data.south < data.north, {
    message: "Invalid bounding box. Expected west<east and south<north.",
  });

// Get WFS capabilities (available layers)
router.get("/capabilities/:source", async (req: Request, res: Response) => {
  try {
    const validation = sourceParamSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid source",
        validSources: VALID_SOURCES,
        details: validation.error.issues,
      });
    }

    const { source } = validation.data;

    const capabilities = await IndeService.getWfsCapabilities(source as any);
    return res.json({ source, layers: capabilities });
  } catch (error: any) {
    logger.error("INDE capabilities endpoint error", {
      error,
      source: req.params.source,
    });
    return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
  }
});

// Get features by bounding box
router.get("/features/:source", async (req: Request, res: Response) => {
  try {
    const sourceValidation = sourceParamSchema.safeParse(req.params);
    if (!sourceValidation.success) {
      return res.status(400).json({
        error: "Invalid source",
        validSources: VALID_SOURCES,
        details: sourceValidation.error.issues,
      });
    }

    const queryValidation = featuresQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      const bboxIssue = queryValidation.error.issues.find(
        (i) => i.path.length === 0 || ["west", "east", "south", "north"].some((f) => i.path.includes(f)),
      );
      const errorMessage = bboxIssue
        ? "Invalid bounding box. Expected west<east and south<north."
        : "Parâmetros inválidos";
      return res.status(400).json({
        error: errorMessage,
        details: queryValidation.error.issues,
      });
    }

    const { source } = sourceValidation.data;
    const { layer, west, south, east, north, limit } = queryValidation.data;

    const features = await IndeService.getFeaturesByBBox(
      layer,
      west,
      south,
      east,
      north,
      source as any,
      limit,
    );

    if (features) {
      return res.json(features);
    } else {
      return res.status(404).json({ error: "No features found" });
    }
  } catch (error: any) {
    logger.error("INDE features endpoint error", { error });
    return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
  }
});

// Get WMS map URL
router.get("/wms/:source", async (req: Request, res: Response) => {
  try {
    const sourceValidation = sourceParamSchema.safeParse(req.params);
    if (!sourceValidation.success) {
      return res.status(400).json({
        error: "Invalid source",
        validSources: VALID_SOURCES,
        details: sourceValidation.error.issues,
      });
    }

    const queryValidation = wmsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      const dimensionIssue = queryValidation.error.issues.find((i) =>
        ["width", "height"].some((f) => i.path.includes(f)),
      );
      const bboxIssue = !dimensionIssue && queryValidation.error.issues.find(
        (i) => i.path.length === 0 || ["west", "east", "south", "north"].some((f) => i.path.includes(f)),
      );
      const errorMessage = dimensionIssue
        ? "Invalid width/height. Expected values between 64 and 4096."
        : bboxIssue
          ? "Invalid bounding box. Expected west<east and south<north."
          : "Parâmetros inválidos";
      return res.status(400).json({
        error: errorMessage,
        details: queryValidation.error.issues,
      });
    }

    const { source } = sourceValidation.data;
    const { layer, west, south, east, north, width, height } =
      queryValidation.data;

    const mapUrl = IndeService.getWmsMapUrl(
      layer,
      west,
      south,
      east,
      north,
      width,
      height,
      source as any,
    );

    return res.json({ url: mapUrl });
  } catch (error: any) {
    logger.error("INDE WMS endpoint error", { error });
    return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
  }
});

export default router;
