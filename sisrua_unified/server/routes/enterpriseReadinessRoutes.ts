/**
 * enterpriseReadinessRoutes.ts — Rotas Enterprise Readiness (121 + 122 + 123 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import { EnterpriseReadinessService } from "../services/enterpriseReadinessService.js";

const router = Router();

// ── 121: Hardening corporativo ────────────────────────────────────────────────

// GET /api/enterprise/hardening/checks — executa verificações de hardening
router.get("/hardening/checks", async (_req, res) => {
  try {
    const checks = await EnterpriseReadinessService.runHardeningChecks();
    const hasFailure = checks.some((c) => c.status === "falha");
    res.status(hasFailure ? 207 : 200).json({ checks, hasFailure });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao executar verificações de hardening", detail: String(err) });
  }
});

// ── 122: Homologação Enterprise ───────────────────────────────────────────────

// GET /api/enterprise/onboarding/checklist — checklist de homologação
router.get("/onboarding/checklist", (req, res) => {
  try {
    const area = req.query.area as string | undefined;
    res.json(
      EnterpriseReadinessService.getOnboardingChecklist(area as never),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter checklist de onboarding", detail: String(err) });
  }
});

// GET /api/enterprise/onboarding/progress — progresso do checklist
router.get("/onboarding/progress", (_req, res) => {
  try {
    res.json(EnterpriseReadinessService.getOnboardingProgress());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao calcular progresso de onboarding", detail: String(err) });
  }
});

const MarkChecklistSchema = z.object({
  verified: z.boolean(),
  note: z.string().optional(),
});

// PATCH /api/enterprise/onboarding/checklist/:id — atualiza item do checklist
router.patch("/onboarding/checklist/:id", (req, res) => {
  const parsed = MarkChecklistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const item = EnterpriseReadinessService.markChecklistItem(
      req.params.id,
      parsed.data.verified,
      parsed.data.note,
    );
    res.json(item);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível atualizar o item.", detail: String(err) });
  }
});

// ── 123: On-Premise / Híbrido ─────────────────────────────────────────────────

// GET /api/enterprise/deployment/modes — modos de implantação disponíveis
router.get("/deployment/modes", (req, res) => {
  try {
    const mode = req.query.mode as string | undefined;
    res.json(
      EnterpriseReadinessService.getDeploymentModes(mode as never),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter modos de implantação", detail: String(err) });
  }
});

// GET /api/enterprise/deployment/detect — detecta modo de implantação atual
router.get("/deployment/detect", (_req, res) => {
  try {
    res.json(EnterpriseReadinessService.detectDeploymentMode());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao detectar modo de implantação", detail: String(err) });
  }
});

export default router;
