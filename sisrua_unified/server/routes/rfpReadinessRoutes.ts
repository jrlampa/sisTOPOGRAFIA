/**
 * rfpReadinessRoutes.ts — Rotas RFP/RFI Readiness (117 [T1])
 */

import { Router } from "express";
import { RfpReadinessService, type RfpCategory } from "../services/rfpReadinessService.js";

const router = Router();

// GET /api/rfp/library — biblioteca completa (com filtro opcional ?category=)
router.get("/library", (req, res) => {
  try {
    const category = req.query.category as RfpCategory | undefined;
    res.json(RfpReadinessService.getLibrary(category));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter biblioteca RFP", detail: String(err) });
  }
});

// GET /api/rfp/search?q= — busca por texto livre
router.get("/search", (req, res) => {
  const query = (req.query.q as string) ?? "";
  if (!query.trim()) {
    return res
      .status(400)
      .json({ error: "Parâmetro 'q' é obrigatório para busca." });
  }
  try {
    res.json(RfpReadinessService.search(query));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro na busca RFP", detail: String(err) });
  }
});

// GET /api/rfp/architecture — referência de arquitetura (com filtro opcional ?tier=)
router.get("/architecture", (req, res) => {
  try {
    const tier = req.query.tier as "frontend" | "backend" | "dados" | "infra" | "seguranca" | undefined;
    res.json(RfpReadinessService.getArchitectureRef(tier));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter referência de arquitetura", detail: String(err) });
  }
});

// GET /api/rfp/readiness-profile — perfil de prontidão por categoria
router.get("/readiness-profile", (_req, res) => {
  try {
    res.json(RfpReadinessService.getReadinessProfile());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao gerar perfil de prontidão", detail: String(err) });
  }
});

export default router;
