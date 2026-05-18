/**
 * predictiveMaintenanceRoutes.ts — Rotas IA Preditiva (T3-133).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { PredictiveMaintenanceService } from "../services/predictiveMaintenanceService.js";
import { logger } from "../utils/logger.js";

const router = Router();

const AssetHealthSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["transformer", "pole"]),
  nominalPowerKva: z.number().optional(),
  currentDemandKva: z.number().optional(),
  solarExposurePct: z.number().optional(),
  ageYears: z.number().optional(),
  billedBrlMonthly: z.number().optional(),
  material: z.string().optional(),
});

/**
 * POST /api/maintenance/predictive/asset
 * Analisa a saúde de um ativo específico.
 */
router.post("/asset", async (req: Request, res: Response) => {
  try {
    const parse = AssetHealthSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "Dados do ativo inválidos.", details: parse.error.issues });

    const locale = (req.query.locale as string) || "pt-BR";
    const result = await PredictiveMaintenanceService.analyzeAssetHealth(parse.data as any, locale);
    
    return res.json(result);
  } catch (err: any) {
    logger.error("Erro na rota de manutenção preditiva", { error: err.message });
    return res.status(500).json({ error: "Falha ao processar análise IA." });
  }
});

export default router;
