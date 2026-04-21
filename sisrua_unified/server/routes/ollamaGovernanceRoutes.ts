/**
 * ollamaGovernanceRoutes.ts — Rotas de Governança Ollama Zero-Custo (14A + 14B [T1]).
 *
 * Endpoints:
 *   GET  /api/ollama/governance/report               — relatório completo de governança
 *   GET  /api/ollama/governance/compatibility        — matriz de compatibilidade
 *   GET  /api/ollama/governance/deprecation-alerts   — alertas de depreciação iminente
 *   POST /api/ollama/governance/validate-model       — valida se modelo está homologado
 *   POST /api/ollama/governance/regression           — executa testes de regressão de prompt
 *   GET  /api/ollama/governance/rollback-check       — verifica necessidade de rollback
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { OllamaGovernanceService } from "../services/ollamaGovernanceService.js";

const router = Router();

// ─── GET /report ─────────────────────────────────────────────────────────────

router.get("/report", async (_req: Request, res: Response) => {
  try {
    const report = await OllamaGovernanceService.getGovernanceReport();
    res.json(report);
  } catch (error) {
    logger.error("[OllamaGovernance] Erro ao gerar relatório de governança", {
      error,
    });
    res.status(500).json({ error: "Erro interno ao gerar relatório de governança." });
  }
});

// ─── GET /compatibility ───────────────────────────────────────────────────────

router.get("/compatibility", (_req: Request, res: Response) => {
  const matrix = OllamaGovernanceService.getCompatibilityMatrix();
  res.json({ total: matrix.length, modelos: matrix });
});

// ─── GET /deprecation-alerts ──────────────────────────────────────────────────

const deprecationQuerySchema = z.object({
  dias: z.coerce.number().int().min(1).max(365).optional().default(30),
});

router.get("/deprecation-alerts", (req: Request, res: Response) => {
  const parsed = deprecationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetro 'dias' inválido (1–365)." });
    return;
  }
  const alerts = OllamaGovernanceService.getDeprecationAlerts(parsed.data.dias);
  res.json({ total: alerts.length, alertas: alerts });
});

// ─── POST /validate-model ─────────────────────────────────────────────────────

const validateModelSchema = z.object({
  model: z.string().min(1).max(120),
});

router.post("/validate-model", (req: Request, res: Response) => {
  const parsed = validateModelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Campo 'model' obrigatório (string)." });
    return;
  }
  const result = OllamaGovernanceService.isModelHomologated(parsed.data.model);
  const entry = OllamaGovernanceService.getModelEntry(parsed.data.model);
  res.json({ model: parsed.data.model, ...result, detalhe: entry });
});

// ─── POST /regression ────────────────────────────────────────────────────────

router.post("/regression", async (_req: Request, res: Response) => {
  try {
    const results = await OllamaGovernanceService.runPromptRegression();
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    res.json({ total: results.length, passed, failed, resultados: results });
  } catch (error) {
    logger.error("[OllamaGovernance] Erro nos testes de regressão de prompt", {
      error,
    });
    res.status(500).json({ error: "Erro ao executar regressão de prompt." });
  }
});

// ─── GET /rollback-check ──────────────────────────────────────────────────────

router.get("/rollback-check", async (_req: Request, res: Response) => {
  try {
    const check = await OllamaGovernanceService.checkAndAlertRollback();
    res.json(check);
  } catch (error) {
    logger.error("[OllamaGovernance] Erro na verificação de rollback", {
      error,
    });
    res.status(500).json({ error: "Erro ao verificar rollback." });
  }
});

export default router;
