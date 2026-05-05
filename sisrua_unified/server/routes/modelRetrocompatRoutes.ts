/**
 * modelRetrocompatRoutes.ts — Rotas REST para Retrocompatibilidade de Modelos (14B [T1])
 */

import { Router } from "express";
import { z } from "zod";
import {
  getActiveModels,
  getStableModels,
  getFallbackModel,
  checkCompatibility,
  getDeprecationAlerts,
  getModelById,
  getAllPromptTemplates,
  getPromptTemplateById,
} from "../services/modelRetrocompatService.js";

const router = Router();

/**
 * GET /api/model-retrocompat/models
 * Lista todos os modelos ativos (não removidos).
 */
router.get("/models", (_req, res) => {
  res.json(getActiveModels());
});

/**
 * GET /api/model-retrocompat/models/stable
 * Lista apenas modelos stable.
 */
router.get("/models/stable", (_req, res) => {
  res.json(getStableModels());
});

/**
 * GET /api/model-retrocompat/models/:modelId
 * Retorna detalhes de um modelo específico.
 */
router.get("/models/:modelId", (req, res) => {
  const model = getModelById(req.params.modelId);
  if (!model) {
    res.status(404).json({ error: `Modelo '${req.params.modelId}' não encontrado.` });
    return;
  }
  res.json(model);
});

/**
 * GET /api/model-retrocompat/models/:modelId/fallback
 * Retorna modelo de fallback para um modelo depreciado/removido.
 */
router.get("/models/:modelId/fallback", (req, res) => {
  const fallback = getFallbackModel(req.params.modelId);
  if (!fallback) {
    res.status(404).json({ error: `Nenhum fallback disponível para '${req.params.modelId}'.` });
    return;
  }
  res.json(fallback);
});

/**
 * GET /api/model-retrocompat/deprecation-alerts
 * Lista alertas de depreciação e remoção com orientações de migração.
 */
router.get("/deprecation-alerts", (_req, res) => {
  res.json(getDeprecationAlerts());
});

/**
 * GET /api/model-retrocompat/templates
 * Lista todos os templates de prompt disponíveis.
 */
router.get("/templates", (_req, res) => {
  res.json(getAllPromptTemplates());
});

/**
 * GET /api/model-retrocompat/templates/:templateId
 * Retorna um template de prompt específico.
 */
router.get("/templates/:templateId", (req, res) => {
  const template = getPromptTemplateById(req.params.templateId);
  if (!template) {
    res.status(404).json({ error: `Template '${req.params.templateId}' não encontrado.` });
    return;
  }
  res.json(template);
});

const compatibilitySchema = z.object({
  modelId: z.string().min(1),
  promptTemplateId: z.string().min(1),
});

/**
 * POST /api/model-retrocompat/check-compatibility
 * Verifica se um modelo é compatível com um template de prompt.
 */
router.post("/check-compatibility", (req, res) => {
  const parsed = compatibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "modelId e promptTemplateId são obrigatórios.", details: parsed.error.issues });
    return;
  }
  const result = checkCompatibility(parsed.data.modelId, parsed.data.promptTemplateId);
  res.json(result);
});

export default router;
