/**
 * investorAuditRoutes.ts — Rotas para Investor Audit Reporting (T2-70).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  InvestorAuditService,
  DimensaoAuditoria,
  NivelRisco,
} from "../services/investorAuditService.js";

const router = Router();

const dimensoesValidas: [DimensaoAuditoria, ...DimensaoAuditoria[]] = [
  "confiabilidade_sistema",
  "conformidade_regulatoria",
  "qualidade_dados",
  "saude_financeira",
];

const niveisRiscoValidos: [NivelRisco, ...NivelRisco[]] = [
  "baixo",
  "medio",
  "alto",
  "critico",
];

const criarRelatorioSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(1),
  periodoReferencia: z.string().min(1),
  projetoId: z.string().optional(),
});

const adicionarMetricaSchema = z.object({
  dimensao: z.enum(dimensoesValidas),
  nome: z.string().min(2),
  valor: z.number().min(0).max(100),
  peso: z.number().positive().optional(),
  observacao: z.string().optional(),
});

const adicionarRiscoSchema = z.object({
  nivel: z.enum(niveisRiscoValidos),
  categoria: z.string().min(2),
  descricao: z.string().min(5),
  mitigacao: z.string().optional(),
});

// ─── POST /relatorios ─────────────────────────────────────────────────────────
router.post("/relatorios", (req: Request, res: Response) => {
  const parse = criarRelatorioSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const relatorio = InvestorAuditService.criarRelatorio(parse.data);
  return res.status(201).json(relatorio);
});

// ─── GET /relatorios?tenantId= ────────────────────────────────────────────────
router.get("/relatorios", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ erro: "Parâmetro tenantId obrigatório" });
  }
  return res.json(InvestorAuditService.listarRelatorios(tenantId));
});

// ─── GET /relatorios/:id ──────────────────────────────────────────────────────
router.get("/relatorios/:id", (req: Request, res: Response) => {
  const rel = InvestorAuditService.obterRelatorio(req.params["id"]!);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── POST /relatorios/:id/metricas ────────────────────────────────────────────
router.post("/relatorios/:id/metricas", (req: Request, res: Response) => {
  const parse = adicionarMetricaSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const resultado = InvestorAuditService.adicionarMetrica(req.params["id"]!, parse.data);
  if ("erro" in resultado) {
    return res.status(422).json(resultado);
  }
  return res.status(201).json(resultado);
});

// ─── POST /relatorios/:id/riscos ──────────────────────────────────────────────
router.post("/relatorios/:id/riscos", (req: Request, res: Response) => {
  const parse = adicionarRiscoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const rel = InvestorAuditService.adicionarRisco(req.params["id"]!, parse.data);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.status(201).json(rel);
});

// ─── POST /relatorios/:id/calcular ────────────────────────────────────────────
router.post("/relatorios/:id/calcular", (req: Request, res: Response) => {
  const resultado = InvestorAuditService.calcularScore(req.params["id"]!);
  if ("erro" in resultado) {
    return res.status(422).json(resultado);
  }
  return res.json(resultado);
});

// ─── POST /relatorios/:id/publicar ────────────────────────────────────────────
router.post("/relatorios/:id/publicar", (req: Request, res: Response) => {
  const rel = InvestorAuditService.publicarRelatorio(req.params["id"]!);
  if (!rel) {
    return res.status(422).json({ erro: "Relatório não encontrado ou não calculado" });
  }
  return res.json(rel);
});

// ─── GET /dimensoes ───────────────────────────────────────────────────────────
router.get("/dimensoes", (_req: Request, res: Response) => {
  return res.json(InvestorAuditService.listarDimensoes());
});

export default router;
