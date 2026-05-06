/**
 * onPremiseRoutes.ts — Rotas REST para Suporte On-Premise / Híbrido (123 [T1])
 */

import { Router } from "express";
import {
  detectDeploymentMode,
  getIsolatedConfig,
  generateOnPremiseReadinessReport,
} from "../services/onPremiseService.js";

const router = Router();

/**
 * GET /api/on-premise/mode
 * Detecta e retorna o modo de implantação atual.
 */
router.get("/mode", (_req, res) => {
  const { mode, reason } = detectDeploymentMode();
  res.json({ mode, reason });
});

/**
 * GET /api/on-premise/config
 * Retorna configuração isolada para o modo detectado.
 */
router.get("/config", (_req, res) => {
  const { mode } = detectDeploymentMode();
  const config = getIsolatedConfig(mode);
  res.json(config);
});

/**
 * GET /api/on-premise/readiness
 * Gera relatório de prontidão para implantação on-premise/híbrida.
 */
router.get("/readiness", (_req, res) => {
  const report = generateOnPremiseReadinessReport();
  res.json(report);
});

export default router;
