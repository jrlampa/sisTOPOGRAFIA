import { Router, Request, Response } from "express";
import { IndeService } from "../services/indeService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { createListQuerySchema } from "../schemas/apiSchemas.js";
import { buildListMeta, comparePrimitiveValues } from "../utils/listing.js";

const router = Router();
const INDE_INTERNAL_ERROR_RESPONSE = {
  error: "INDE service temporarily unavailable",
};

const VALID_SOURCES = ["ibge", "icmbio", "ana", "dnit"] as const;
const sourceParamSchema = z.object({
  source: z.enum(VALID_SOURCES),
});

type IndeSource = z.infer<typeof sourceParamSchema>["source"];
type FeatureWithId = { id?: string | number };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

const bboxQueryObjectSchema = z.object({
  layer: z.string().trim().min(1),
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
});

const featuresQuerySchema = createListQuerySchema(
  {
    defaultLimit: 1000,
    maxLimit: 5000,
    sortBy: ["id"],
    defaultSortBy: "id",
    defaultSortOrder: "asc",
  },
  {
    ...bboxQueryObjectSchema.shape,
  },
)
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

    const capabilities = await IndeService.getWfsCapabilities(source as IndeSource);
    return res.json({ source, layers: capabilities });
  } catch (error: unknown) {
    logger.error("INDE capabilities endpoint error", {
      error: getErrorMessage(error),
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
      return res.status(400).json({
        error: "Parâmetros inválidos",
        details: queryValidation.error.issues,
      });
    }

    const { source } = sourceValidation.data;
    const { layer, west, south, east, north, limit, offset, sortBy, sortOrder } =
      queryValidation.data;

    const features = await IndeService.getFeaturesByBBox(
      layer,
      west,
      south,
      east,
      north,
      source as IndeSource,
      limit,
    );

    if (features) {
      const originalFeatures: FeatureWithId[] = Array.isArray(features.features)
        ? ([...features.features] as FeatureWithId[])
        : [];
      const sortedFeatures =
        sortBy === "id"
          ? originalFeatures.sort((left, right) =>
              comparePrimitiveValues(left?.id, right?.id, sortOrder),
            )
          : originalFeatures;
      const paginatedFeatures = sortedFeatures.slice(offset, offset + limit);

      return res.json({
        ...features,
        features: paginatedFeatures,
        total: originalFeatures.length,
        limit,
        offset,
        meta: buildListMeta({
          limit,
          offset,
          total: originalFeatures.length,
          returned: paginatedFeatures.length,
          sortBy,
          sortOrder,
          filters: {
            source,
            layer,
          },
        }),
      });
    } else {
      return res.status(404).json({ error: "No features found" });
    }
  } catch (error: unknown) {
    logger.error("INDE features endpoint error", { error: getErrorMessage(error) });
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
      return res.status(400).json({
        error: "Parâmetros inválidos",
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
      source as IndeSource,
    );

    return res.json({ url: mapUrl });
  } catch (error: unknown) {
    logger.error("INDE WMS endpoint error", { error: getErrorMessage(error) });
    return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
  }
});

export default router;
