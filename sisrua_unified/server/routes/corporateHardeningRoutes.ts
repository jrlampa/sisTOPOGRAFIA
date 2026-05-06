/**
 * corporateHardeningRoutes.ts — Rotas REST para Hardening Corporativo (121 [T1])
 */

import { Router } from "express";
import { runCorporateHardeningChecks } from "../services/corporateHardeningService.js";

const router = Router();

/**
 * GET /api/corporate-hardening/report
 * Executa verificações de hardening e retorna relatório completo.
 */
router.get("/report", (_req, res) => {
  const report = runCorporateHardeningChecks();
  res.json(report);
});

/**
 * GET /api/corporate-hardening/score
 * Retorna apenas o score e status geral (resposta leve para health-check dashboards).
 */
router.get("/score", (_req, res) => {
  const { score, overallStatus, summary, timestamp } = runCorporateHardeningChecks();
  res.json({ score, overallStatus, summary, timestamp });
});

export default router;
