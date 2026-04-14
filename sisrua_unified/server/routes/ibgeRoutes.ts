import { Router, Request, Response } from "express";
import { IbgeService } from "../services/ibgeService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { createListQuerySchema } from "../schemas/apiSchemas.js";
import { buildListMeta, comparePrimitiveValues } from "../utils/listing.js";

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

const statesListQuerySchema = createListQuerySchema(
  {
    defaultLimit: 27,
    maxLimit: 100,
    sortBy: ["nome", "sigla", "id"],
    defaultSortBy: "nome",
    defaultSortOrder: "asc",
  },
  {
    search: z.string().trim().min(1).optional(),
  },
);

const municipiosListQuerySchema = createListQuerySchema(
  {
    defaultLimit: 100,
    maxLimit: 1000,
    sortBy: ["nome", "id"],
    defaultSortBy: "nome",
    defaultSortOrder: "asc",
  },
  {
    search: z.string().trim().min(1).optional(),
  },
);

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
router.get("/states", async (req: Request, res: Response) => {
  try {
    const validation = statesListQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: "Parâmetros inválidos", details: validation.error.issues });
    }

    const { limit, offset, sortBy, sortOrder, search } = validation.data;
    const states = await IbgeService.getStates();
    const filteredStates = states
      .filter((state) => {
        if (!search) {
          return true;
        }

        const normalizedSearch = search.toLowerCase();
        return (
          state.nome.toLowerCase().includes(normalizedSearch) ||
          state.sigla?.toLowerCase().includes(normalizedSearch) ||
          state.id.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "sigla":
            return comparePrimitiveValues(left.sigla, right.sigla, sortOrder);
          case "id":
            return comparePrimitiveValues(left.id, right.id, sortOrder);
          case "nome":
          default:
            return comparePrimitiveValues(left.nome, right.nome, sortOrder);
        }
      });

    const items = filteredStates.slice(offset, offset + limit);
    return res.json({
      states: items,
      total: filteredStates.length,
      limit,
      offset,
      meta: buildListMeta({
        limit,
        offset,
        total: filteredStates.length,
        returned: items.length,
        sortBy,
        sortOrder,
        filters: {
          search: search ?? null,
        },
      }),
    });
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

    const queryValidation = municipiosListQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res
        .status(400)
        .json({ error: "Parâmetros inválidos", details: queryValidation.error.issues });
    }

    const { uf } = validation.data;
    const { limit, offset, sortBy, sortOrder, search } = queryValidation.data;
    const municipios = await IbgeService.getMunicipiosByState(uf.toUpperCase());
    const filteredMunicipios = municipios
      .filter((municipio) => {
        if (!search) {
          return true;
        }

        const normalizedSearch = search.toLowerCase();
        return (
          municipio.nome.toLowerCase().includes(normalizedSearch) ||
          municipio.id.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "id":
            return comparePrimitiveValues(left.id, right.id, sortOrder);
          case "nome":
          default:
            return comparePrimitiveValues(left.nome, right.nome, sortOrder);
        }
      });

    const items = filteredMunicipios.slice(offset, offset + limit);
    return res.json({
      municipios: items,
      total: filteredMunicipios.length,
      limit,
      offset,
      meta: buildListMeta({
        limit,
        offset,
        total: filteredMunicipios.length,
        returned: items.length,
        sortBy,
        sortOrder,
        filters: {
          search: search ?? null,
          uf: uf.toUpperCase(),
        },
      }),
    });
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
