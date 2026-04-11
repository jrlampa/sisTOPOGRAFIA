/**
 * API Routes for Mechanical Calculation & Scenario Analysis
 *
 * Endpoints:
 *   POST /api/v1/mechanical/poste/calculate       — Calculate pole load
 *   POST /api/v1/mechanical/poste/select          — Select from catalog
 *   POST /api/v1/scenarios/analyze                — Analyze & rank scenarios
 *   GET  /api/v1/scenarios/catalog                — Retrieve catalogs
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  calculatePosteLoad,
  selecionarPosteDeCatalogo,
  calculateForceVento,
  calculateResultantForce,
} from "../core/mechanicalCalc/posteCalc.js";
import {
  calculateScenarioScore,
  rankScenarios,
  compararCenarios,
  type ScenarioScoreInput,
} from "../services/scenarioAnalysisService.js";
import {
  PosteInput,
  ConductorForceInput,
  VentoInput,
  PosteCatalogEntry,
} from "../core/mechanicalCalc/types.js";

const router = Router();

// ─── Error handler middleware ────────────────────────────────────────────────

const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ─── Mechanical Routes ──────────────────────────────────────────────────────

/**
 * POST /api/v1/mechanical/poste/calculate
 *
 * Calculate pole bending moment and verify structural adequacy
 *
 * Request body:
 * {
 *   "poste": { "alturaM": 11, "diametroTopoMm": 180, ... },
 *   "forcas": [
 *     { "componente": { "fx": 100, "fy": 6 }, "momentoKnM": 1.1 }
 *   ]
 * }
 */
router.post(
  "/poste/calculate",
  asyncHandler(async (req: Request, res: Response) => {
    const { poste, forcas } = req.body;

    if (!poste || !forcas || !Array.isArray(forcas)) {
      return res
        .status(400)
        .json({ error: "Invalid request: poste and forcas required" });
    }

    try {
      const resultado = calculatePosteLoad(poste as PosteInput, forcas);

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (err) {
      return res.status(400).json({ error: String(err) });
    }
  }),
);

/**
 * POST /api/v1/mechanical/poste/select
 *
 * Select adequate pole from catalog
 *
 * Request body:
 * {
 *   "momentoFletorDaN_m": 550,
 *   "margemSegurancaPercent": 10,
 *   "catalogo": [ ... ]
 * }
 */
router.post(
  "/poste/select",
  asyncHandler(async (req: Request, res: Response) => {
    const { momentoFletorDaN_m, margemSegurancaPercent, catalogo } = req.body;

    if (!momentoFletorDaN_m || !catalogo) {
      return res
        .status(400)
        .json({
          error: "Invalid request: momentoFletorDaN_m and catalogo required",
        });
    }

    try {
      const posteEscolhido = selecionarPosteDeCatalogo(
        catalogo as PosteCatalogEntry[],
        momentoFletorDaN_m,
        margemSegurancaPercent || 10,
      );

      if (!posteEscolhido) {
        return res.status(404).json({
          success: false,
          message: "No adequate pole found in catalog for given load",
        });
      }

      return res.status(200).json({
        success: true,
        data: posteEscolhido,
      });
    } catch (err) {
      return res.status(400).json({ error: String(err) });
    }
  }),
);

/**
 * POST /api/v1/mechanical/conductor/forces
 *
 * Calculate conductor wind forces and decompose into components
 *
 * Request body:
 * {
 *   "condutor": { "codigo": "CA 3/0", "vaoM": 33, ... },
 *   "vento": { "velocidadeMs": 20, "coeficienteArrasto": 1.2, ... }
 * }
 */
router.post(
  "/conductor/forces",
  asyncHandler(async (req: Request, res: Response) => {
    const { condutor, vento } = req.body;

    if (!condutor || !vento) {
      return res
        .status(400)
        .json({ error: "Invalid request: condutor and vento required" });
    }

    try {
      const forcas = calculateForceVento({
        ...(condutor as ConductorForceInput),
        ...(vento as VentoInput),
      });

      const resultante = calculateResultantForce(
        forcas.componenteFxN / 9.81,
        forcas.componenteFyN / 9.81,
        (condutor as any).alturaInstalacaoM || 8,
      );

      return res.status(200).json({
        success: true,
        data: {
          forcas,
          resultante,
        },
      });
    } catch (err) {
      return res.status(400).json({ error: String(err) });
    }
  }),
);

// ─── Scenario Analysis Routes ───────────────────────────────────────────────

/**
 * POST /api/v1/scenarios/analyze
 *
 * Analyze and rank multiple CQT scenarios
 *
 * Request body:
 * {
 *   "scenarios": [
 *     {
 *       "cenarioId": "ATUAL",
 *       "trafoKva": 225,
 *       "resultadosEsq": { "lado": "ESQUERDO", "cargaTotalKva": 95, "cqtPercent": 3.5, ... },
 *       "resultadosDir": { "lado": "DIREITO", "cargaTotalKva": 92, "cqtPercent": 3.2, ... },
 *       "resultadoTrafo": { ... }
 *     },
 *     ...
 *   ]
 * }
 */
router.post(
  "/analyze",
  asyncHandler(async (req: Request, res: Response) => {
    const { scenarios } = req.body;

    if (!scenarios || !Array.isArray(scenarios)) {
      return res
        .status(400)
        .json({ error: "Invalid request: scenarios array required" });
    }

    try {
      const ranking = rankScenarios(scenarios as ScenarioScoreInput[]);

      return res.status(200).json({
        success: true,
        data: {
          ranking,
          recomendacaoPrincipal: ranking[0]
            ? `Cenário ${ranking[0].cenarioId} é o mais adequado (score: ${ranking[0].scoreGlobal})`
            : "Nenhum cenário analisado",
        },
      });
    } catch (err) {
      return res.status(400).json({ error: String(err) });
    }
  }),
);

/**
 * POST /api/v1/scenarios/compare
 *
 * Compare two scenarios and return delta analysis
 *
 * Request body:
 * {
 *   "cenarioBase": { ... },
 *   "cenarioAlternativo": { ... }
 * }
 */
router.post(
  "/compare",
  asyncHandler(async (req: Request, res: Response) => {
    const { cenarioBase, cenarioAlternativo } = req.body;

    if (!cenarioBase || !cenarioAlternativo) {
      return res
        .status(400)
        .json({
          error: "Invalid request: cenarioBase and cenarioAlternativo required",
        });
    }

    try {
      const scoreBase = calculateScenarioScore(
        cenarioBase as ScenarioScoreInput,
      );
      const scoreAlternativo = calculateScenarioScore(
        cenarioAlternativo as ScenarioScoreInput,
      );

      const delta = compararCenarios(scoreBase, scoreAlternativo);

      return res.status(200).json({
        success: true,
        data: {
          scoreBase,
          scoreAlternativo,
          delta,
        },
      });
    } catch (err) {
      return res.status(400).json({ error: String(err) });
    }
  }),
);

// ─── Catalog endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/v1/scenarios/catalog/postes
 *
 * Retrieve standard pole catalog
 */
router.get("/catalog/postes", (req: Request, res: Response) => {
  const catalogo: PosteCatalogEntry[] = [
    {
      modelo: "DT 11m/300",
      alturaM: 11,
      diametroTopoMm: 180,
      diametroBaseMm: 360,
      rupturaKnM: 3.0,
      pesoKg: 350,
      materialTipo: "CIMENTO",
    },
    {
      modelo: "DT 11m/600",
      alturaM: 11,
      diametroTopoMm: 180,
      diametroBaseMm: 360,
      rupturaKnM: 6.0,
      pesoKg: 420,
      materialTipo: "CIMENTO",
    },
    {
      modelo: "DT 12m/300",
      alturaM: 12,
      diametroTopoMm: 190,
      diametroBaseMm: 380,
      rupturaKnM: 3.0,
      pesoKg: 480,
      materialTipo: "CIMENTO",
    },
    {
      modelo: "DT 12m/600",
      alturaM: 12,
      diametroTopoMm: 190,
      diametroBaseMm: 380,
      rupturaKnM: 6.0,
      pesoKg: 550,
      materialTipo: "CIMENTO",
    },
  ];

  return res.status(200).json({
    success: true,
    data: catalogo,
  });
});

/**
 * GET /api/v1/scenarios/catalog/condutores
 *
 * Retrieve conductor reference table (abbreviated)
 */
router.get("/catalog/condutores", (req: Request, res: Response) => {
  const condutores = [
    { codigo: "CA 1/0 AWG", diametroMm: 8.25, pesoKgPerM: 0.117 },
    { codigo: "CA 3/0 AWG", diametroMm: 10.4, pesoKgPerM: 0.186 },
    { codigo: "CA 4/0 AWG", diametroMm: 11.7, pesoKgPerM: 0.234 },
    { codigo: "CAA 477 MCM", diametroMm: 21.8, pesoKgPerM: 0.715 },
    { codigo: "50 Al", diametroMm: 8.27, pesoKgPerM: 0.137 },
    { codigo: "70 Al", diametroMm: 10.31, pesoKgPerM: 0.192 },
  ];

  return res.status(200).json({
    success: true,
    data: condutores,
  });
});

/**
 * GET /api/v1/scenarios/catalog/vento-coeficientes
 *
 * Wind drag coefficient table by conductor type
 */
router.get("/catalog/vento-coeficientes", (req: Request, res: Response) => {
  const coeficientes = [
    { tipo: "PRIMARIO", coeficiente: 1.2 },
    { tipo: "SECUNDARIO", coeficiente: 1.0 },
    { tipo: "ESTRUTURA", coeficiente: 1.2 },
    { tipo: "ISOLADOR_CORRENTE", coeficiente: 1.4 },
    { tipo: "CABO_ACO", coeficiente: 1.0 },
    { tipo: "PARA_RAIO", coeficiente: 1.2 },
  ];

  return res.status(200).json({
    success: true,
    data: coeficientes,
  });
});

// ─── Error handler (must be last) ────────────────────────────────────────────

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[API Error]", err);
  return res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
  });
});

export default router;
