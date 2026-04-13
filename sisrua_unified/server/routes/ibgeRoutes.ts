import { Router, Request, Response } from "express";
import { IbgeService } from "../services/ibgeService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

const router = Router();
const IBGE_INTERNAL_ERROR_RESPONSE = {
  error: "IBGE service temporarily unavailable",
};

const ibgeLocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const ufParamSchema = z.object({
  uf: z.string().trim().length(2),
});

const municipalityIdParamSchema = z.object({
  id: z.string().trim().min(1).max(32).regex(/^\d+$/, "id deve ser numérico"),
});

// Get location info by coordinates (reverse geocoding)
router.get("/location", async (req: Request, res: Response) => {
  try {
    const validation = ibgeLocationQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res
        .status(400)
        .json({
          error: "Parâmetros inválidos",
          details: validation.error.issues,
        });
    }

    const { lat: latitude, lng: longitude } = validation.data;

    logger.info("IBGE reverse geocoding", { lat: latitude, lng: longitude });

    const locationInfo = await IbgeService.findMunicipioByCoordinates(
      latitude,
      longitude,
    );

    if (locationInfo) {
      return res.json(locationInfo);
    } else {
      return res
        .status(404)
        .json({ error: "Location not found in Brazilian territory" });
    }
  } catch (error: any) {
    logger.error("IBGE location endpoint error", { error });
    return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
  }
});

// Get all states
router.get("/states", async (_req: Request, res: Response) => {
  try {
    const states = await IbgeService.getStates();
    return res.json(states);
  } catch (error: any) {
    logger.error("IBGE states endpoint error", { error });
    return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
  }
});

// Get municipalities by state
router.get("/municipios/:uf", async (req: Request, res: Response) => {
  try {
    const validation = ufParamSchema.safeParse(req.params);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: "UF inválida", details: validation.error.issues });
    }

    const { uf } = validation.data;
    const municipios = await IbgeService.getMunicipiosByState(uf.toUpperCase());
    return res.json(municipios);
  } catch (error: any) {
    logger.error("IBGE municipios endpoint error", {
      error,
      uf: req.params.uf,
    });
    return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
  }
});

// Get municipality boundary (GeoJSON)
router.get("/boundary/municipio/:id", async (req: Request, res: Response) => {
  try {
    const validation = municipalityIdParamSchema.safeParse(req.params);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: "id inválido", details: validation.error.issues });
    }

    const { id } = validation.data;
    const boundary = await IbgeService.getMunicipalityBoundary(id);

    if (boundary) {
      return res.json(boundary);
    } else {
      return res.status(404).json({ error: "Municipality boundary not found" });
    }
  } catch (error: any) {
    logger.error("IBGE boundary endpoint error", { error, id: req.params.id });
    return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
  }
});

export default router;
