/**
 * gridLegibilityRoutes.ts — Rotas REST para Legibilidade de Grid (27 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import {
  getAllProfiles,
  getProfileById,
  getDefaultProfile,
  calculateLegibilityMetrics,
  suggestProfile,
} from "../services/gridLegibilityService.js";

const router = Router();

/**
 * GET /api/grid-legibility/profiles
 * Lista todos os perfis de exibição disponíveis.
 */
router.get("/profiles", (_req, res) => {
  res.json(getAllProfiles());
});

/**
 * GET /api/grid-legibility/profiles/default
 * Retorna o perfil padrão.
 */
router.get("/profiles/default", (_req, res) => {
  res.json(getDefaultProfile());
});

/**
 * GET /api/grid-legibility/profiles/:profileId
 * Retorna um perfil específico.
 */
router.get("/profiles/:profileId", (req, res) => {
  const profile = getProfileById(req.params.profileId);
  if (!profile) {
    res.status(404).json({ error: `Perfil '${req.params.profileId}' não encontrado.` });
    return;
  }
  res.json(profile);
});

const metricsSchema = z.object({
  profileId: z.string().min(1),
  totalRows: z.number().int().positive(),
  screenHeightPx: z.number().int().positive().optional(),
});

/**
 * POST /api/grid-legibility/metrics
 * Calcula métricas de legibilidade para um perfil e volume de dados.
 */
router.post("/metrics", (req, res) => {
  const parsed = metricsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "profileId e totalRows (inteiro positivo) são obrigatórios.",
      details: parsed.error.issues,
    });
    return;
  }
  const { profileId, totalRows, screenHeightPx } = parsed.data;
  const metrics = calculateLegibilityMetrics(profileId, totalRows, screenHeightPx);
  res.json(metrics);
});

const suggestSchema = z.object({
  totalRows: z.number().int().positive(),
  context: z.enum(["office", "field", "noc", "presentation"]),
});

/**
 * POST /api/grid-legibility/suggest
 * Sugere o perfil mais adequado para o volume de dados e contexto de uso.
 */
router.post("/suggest", (req, res) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "totalRows e context ('office' | 'field' | 'noc' | 'presentation') são obrigatórios.",
      details: parsed.error.issues,
    });
    return;
  }
  const suggestion = suggestProfile(parsed.data.totalRows, parsed.data.context);
  res.json(suggestion);
});

export default router;
