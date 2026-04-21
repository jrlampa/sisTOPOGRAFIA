/**
 * supplyChainRoutes.ts — Rotas Supply Chain Security (15 [T1])
 *
 * GET  /api/supply-chain/sbom                        — Último SBOM gerado
 * POST /api/supply-chain/sbom/generate               — Gera novo SBOM
 * GET  /api/supply-chain/npm-audit                   — Último resultado de npm audit
 * POST /api/supply-chain/npm-audit/run               — Executa npm audit
 * GET  /api/supply-chain/secrets                     — Lista matches de segredos
 * POST /api/supply-chain/secrets/scan                — Varre texto por segredos
 * PATCH /api/supply-chain/secrets/:id/resolve        — Marca segredo como resolvido
 * GET  /api/supply-chain/sast/findings               — Lista findings SAST
 * POST /api/supply-chain/sast/findings               — Adiciona finding SAST
 * GET  /api/supply-chain/sast/report                 — Relatório SAST resumido
 * PATCH /api/supply-chain/sast/findings/:id/fix      — Marca finding SAST como corrigido
 * GET  /api/supply-chain/policy-gates                — Última avaliação de gates
 * POST /api/supply-chain/policy-gates/evaluate       — Avalia gates para uma versão
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { SupplyChainService, SastSeverity, SastCategory } from "../services/supplyChainService.js";
import * as path from "path";

const router = Router();

// process.cwd() evita conflitos de import.meta no ambiente Jest/ts-jest.
const PROJECT_ROOT = path.resolve(process.cwd());

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PythonComponentSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  license: z.string().nullable().optional(),
});

const GenerateSbomSchema = z.object({
  pythonComponents: z.array(PythonComponentSchema).optional(),
});

const ScanSecretsSchema = z.object({
  content: z.string().min(1),
  fileHint: z.string().min(1),
  startLine: z.number().int().min(1).optional(),
});

const ResolveSecretSchema = z.object({
  resolvedBy: z.string().min(1),
});

const AddSastFindingSchema = z.object({
  ruleId: z.string().min(1),
  category: z.string().min(1) as z.ZodType<SastCategory>,
  severity: z.string().min(1) as z.ZodType<SastSeverity>,
  file: z.string().min(1),
  line: z.number().int().min(1),
  message: z.string().min(1),
  cweId: z.string().nullable().optional(),
  owaspTop10: z.string().nullable().optional(),
});

const EvaluateGatesSchema = z.object({
  releaseVersion: z.string().min(1),
});

// ─── SBOM ─────────────────────────────────────────────────────────────────────

router.get("/sbom", (_req: Request, res: Response) => {
  const sbom = SupplyChainService.getLastSbom();
  if (!sbom) return res.status(404).json({ error: "Nenhum SBOM gerado. Execute POST /sbom/generate primeiro." });
  return res.json(sbom);
});

router.post("/sbom/generate", (req: Request, res: Response) => {
  const parsed = GenerateSbomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const pythonComponents = (parsed.data.pythonComponents ?? []).map((p) => ({
    name: p.name,
    version: p.version,
    license: p.license ?? null,
  }));

  const sbom = SupplyChainService.generateSbom(PROJECT_ROOT, pythonComponents);
  return res.status(201).json(sbom);
});

// ─── npm audit ────────────────────────────────────────────────────────────────

router.get("/npm-audit", (_req: Request, res: Response) => {
  const audit = SupplyChainService.getLastNpmAudit();
  if (!audit) return res.status(404).json({ error: "Nenhum audit executado. Execute POST /npm-audit/run primeiro." });
  return res.json(audit);
});

router.post("/npm-audit/run", (_req: Request, res: Response) => {
  const result = SupplyChainService.runNpmAudit(PROJECT_ROOT);
  const status = result.passed ? 200 : 207;
  return res.status(status).json(result);
});

// ─── Secret Scanning ──────────────────────────────────────────────────────────

router.get("/secrets", (req: Request, res: Response) => {
  const onlyUnresolved = req.query["onlyUnresolved"] === "true";
  return res.json(SupplyChainService.getSecretMatches(onlyUnresolved));
});

router.post("/secrets/scan", (req: Request, res: Response) => {
  const parsed = ScanSecretsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const { content, fileHint, startLine } = parsed.data;
  const result = SupplyChainService.scanForSecrets(content, fileHint, startLine);
  return res.status(201).json(result);
});

router.patch("/secrets/:id/resolve", (req: Request, res: Response) => {
  const parsed = ResolveSecretSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const updated = SupplyChainService.resolveSecretMatch(req.params["id"]!, parsed.data.resolvedBy);
  if (!updated) return res.status(422).json({ error: "Match de segredo não encontrado." });
  return res.json(updated);
});

// ─── SAST ─────────────────────────────────────────────────────────────────────

router.get("/sast/findings", (req: Request, res: Response) => {
  const severity = req.query["severity"] as SastSeverity | undefined;
  const fixed = req.query["fixed"] !== undefined
    ? req.query["fixed"] === "true"
    : undefined;
  const category = req.query["category"] as SastCategory | undefined;

  return res.json(SupplyChainService.getSastFindings({ severity, fixed, category }));
});

router.post("/sast/findings", (req: Request, res: Response) => {
  const parsed = AddSastFindingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const finding = SupplyChainService.addSastFinding({
    ruleId: parsed.data.ruleId,
    category: parsed.data.category,
    severity: parsed.data.severity,
    file: parsed.data.file,
    line: parsed.data.line,
    message: parsed.data.message,
    cweId: parsed.data.cweId ?? null,
    owaspTop10: parsed.data.owaspTop10 ?? null,
  });
  return res.status(201).json(finding);
});

router.get("/sast/report", (_req: Request, res: Response) => {
  return res.json(SupplyChainService.getSastReport());
});

router.patch("/sast/findings/:id/fix", (req: Request, res: Response) => {
  const updated = SupplyChainService.markSastFixed(req.params["id"]!);
  if (!updated) return res.status(422).json({ error: "Finding SAST não encontrado." });
  return res.json(updated);
});

// ─── Policy Gates ─────────────────────────────────────────────────────────────

router.get("/policy-gates", (_req: Request, res: Response) => {
  const eval_ = SupplyChainService.getLastPolicyEvaluation();
  if (!eval_) return res.status(404).json({ error: "Nenhuma avaliação executada. Execute POST /policy-gates/evaluate." });
  return res.json(eval_);
});

router.post("/policy-gates/evaluate", (req: Request, res: Response) => {
  const parsed = EvaluateGatesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const evaluation = SupplyChainService.evaluatePolicyGates(parsed.data.releaseVersion);
  const status = evaluation.passed ? 200 : 207;
  return res.status(status).json(evaluation);
});

export default router;
