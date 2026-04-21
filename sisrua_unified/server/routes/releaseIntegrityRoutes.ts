/**
 * releaseIntegrityRoutes.ts — Rotas de Integridade de Release (16 [T1]).
 *
 * Endpoints:
 *   GET  /api/release/manifest    — gera manifesto de release com hashes SHA-256
 *   GET  /api/release/provenance  — informações de proveniência do build atual
 *   POST /api/release/verify      — verifica integridade de um manifesto recebido
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { ReleaseIntegrityService } from "../services/releaseIntegrityService.js";

const router = Router();

// ─── GET /manifest ────────────────────────────────────────────────────────────

router.get("/manifest", (_req: Request, res: Response) => {
  try {
    const manifest = ReleaseIntegrityService.generateManifest(true);
    res.json(manifest);
  } catch (error) {
    logger.error("[ReleaseIntegrity] Erro ao gerar manifesto", { error });
    res.status(500).json({ error: "Erro interno ao gerar manifesto de release." });
  }
});

// ─── GET /provenance ──────────────────────────────────────────────────────────

router.get("/provenance", (_req: Request, res: Response) => {
  try {
    const provenance = ReleaseIntegrityService.getBuildProvenance();
    res.json(provenance);
  } catch (error) {
    logger.error("[ReleaseIntegrity] Erro ao obter proveniência", { error });
    res.status(500).json({ error: "Erro interno ao obter proveniência do build." });
  }
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

const artifactSchema = z.object({
  name: z.string(),
  relativePath: z.string(),
  sha256: z.string(),
  sizeBytes: z.number(),
});

const manifestSchema = z.object({
  version: z.string(),
  packageName: z.string(),
  buildTime: z.string(),
  packageJsonHash: z.string(),
  artifacts: z.array(artifactSchema),
  signature: z.string().nullable(),
});

const verifyBodySchema = z.object({
  manifest: manifestSchema,
});

router.post("/verify", (req: Request, res: Response) => {
  const parsed = verifyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Corpo inválido. Forneça 'manifest' conforme o esquema ReleaseManifest.",
      detalhe: parsed.error.format(),
    });
    return;
  }

  const result = ReleaseIntegrityService.verifyManifest(parsed.data.manifest);
  res.status(result.valid ? 200 : 422).json(result);
});

export default router;
