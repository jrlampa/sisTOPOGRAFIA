/**
 * formulaVersioningRoutes.ts — T3.73: Versionamento Semântico de Fórmulas
 *
 * GET  /api/formula-versions              – lista todas as fórmulas com versão ativa
 * GET  /api/formula-versions/:id          – detalhe + histórico de versões
 * GET  /api/formula-versions/:id/active   – apenas a versão ativa
 * GET  /api/formula-versions/:id/diff     – diff entre duas versões (?v1=&v2=)
 * GET  /api/formula-versions/deprecation-report – fórmulas com versões depreciadas
 * POST /api/formula-versions/:id          – registra nova versão (requer admin)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { requireAdminToken } from "../middleware/authGuard.js";
import {
  listFormulas,
  getFormulaById,
  getActiveVersion,
  getVersionHistory,
  diffVersions,
  registerFormulaVersion,
  getDeprecationReport,
  type FormulaCategory,
  type VersionStatus,
} from "../services/formulaVersioningService.js";

const router = Router();

const formulaCategoryValues = [
  "bt_radial",
  "cqt",
  "conductor",
  "transformer",
  "standards",
] as const;

const versionStatusValues = [
  "active",
  "deprecated",
  "draft",
  "withdrawn",
] as const;

const newVersionSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir semver (ex: 1.2.3)"),
  status: z.enum(versionStatusValues),
  name: z.string().min(1),
  description: z.string().min(1),
  expression: z.string().min(1),
  constants: z.record(z.string(), z.union([z.number(), z.string()])),
  standardReference: z.string().min(1),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser ISO (YYYY-MM-DD)"),
  deprecatedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  changeReason: z.string().optional(),
  category: z.enum(formulaCategoryValues),
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get("/", (_req: Request, res: Response) => {
  try {
    const formulas = listFormulas();
    return res.json({ count: formulas.length, formulas });
  } catch (err) {
    logger.error("formulaVersioning.list", { err });
    return res.status(500).json({ error: "Erro ao listar fórmulas." });
  }
});

// ─── GET /deprecation-report ──────────────────────────────────────────────────

router.get("/deprecation-report", (_req: Request, res: Response) => {
  try {
    const report = getDeprecationReport();
    return res.json({ count: report.length, deprecations: report });
  } catch (err) {
    logger.error("formulaVersioning.deprecationReport", { err });
    return res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const def = getFormulaById(id);
    if (!def) return res.status(404).json({ error: `Fórmula '${id}' não encontrada.` });
    const history = getVersionHistory(id);
    return res.json({ ...def, versions: history });
  } catch (err) {
    logger.error("formulaVersioning.getById", { id, err });
    return res.status(500).json({ error: "Erro ao buscar fórmula." });
  }
});

// ─── GET /:id/active ──────────────────────────────────────────────────────────

router.get("/:id/active", (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const active = getActiveVersion(id);
    if (!active)
      return res.status(404).json({ error: `Fórmula '${id}' não encontrada ou sem versão ativa.` });
    return res.json(active);
  } catch (err) {
    logger.error("formulaVersioning.getActive", { id, err });
    return res.status(500).json({ error: "Erro ao buscar versão ativa." });
  }
});

// ─── GET /:id/diff ────────────────────────────────────────────────────────────

router.get("/:id/diff", (req: Request, res: Response) => {
  const { id } = req.params;
  const v1 = req.query.v1 as string | undefined;
  const v2 = req.query.v2 as string | undefined;

  if (!v1 || !v2) {
    return res
      .status(400)
      .json({ error: "Parâmetros v1 e v2 são obrigatórios (ex: ?v1=1.0.0&v2=2.0.0)." });
  }

  try {
    const diff = diffVersions(id, v1, v2);
    if (!diff)
      return res
        .status(404)
        .json({ error: `Fórmula '${id}' ou versões '${v1}'/'${v2}' não encontradas.` });
    return res.json(diff);
  } catch (err) {
    logger.error("formulaVersioning.diff", { id, v1, v2, err });
    return res.status(500).json({ error: "Erro ao calcular diff." });
  }
});

// ─── POST /:id ────────────────────────────────────────────────────────────────

router.post("/:id", requireAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const parse = newVersionSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Payload inválido.", details: parse.error.issues });
  }

  const { category, ...versionData } = parse.data;

  try {
    const registered = registerFormulaVersion(
      id,
      category as FormulaCategory,
      {
        ...versionData,
        status: versionData.status as VersionStatus,
      },
    );
    logger.info("formulaVersioning.registered", {
      formulaId: id,
      version: registered.version,
    });
    return res.status(201).json(registered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    logger.error("formulaVersioning.register", { id, err });
    return res.status(409).json({ error: msg });
  }
});

export default router;
