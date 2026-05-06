/**
 * bdiRoiRoutes.ts — Rotas BDI/ROI Analytics (T2-43).
 * Prefixo: /api/bdi-roi
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { BdiRoiService } from "../services/bdiRoiService.js";

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const tipoObraEnum = z.enum([
  "distribuicao_eletrica",
  "transmissao_eletrica",
  "subestacao",
  "iluminacao_publica",
  "obras_civis_complexas",
  "obras_civis_simples",
  "telecomunicacoes",
]);

const componentesBdiSchema = z.object({
  administracaoCentral: z.number().min(0).max(0.5),
  seguroRisco: z.number().min(0).max(0.3),
  despesasFinanceiras: z.number().min(0).max(0.3),
  lucro: z.number().min(0).max(0.5),
  iss: z.number().min(0).max(0.1),
  pis: z.number().min(0).max(0.05),
  cofins: z.number().min(0).max(0.1),
  irpjCsll: z.number().min(0).max(0.15),
});

const calcularBdiSchema = z.object({
  tipoObra: tipoObraEnum,
  tenantId: z.string().min(1).max(80),
  componentes: componentesBdiSchema,
  custoDirectoBase: z.number().positive(),
  projetoId: z.string().max(80).optional(),
});

const fluxoCaixaSchema = z.object({
  ano: z.number().int().min(1).max(50),
  fluxo: z.number(),
});

const calcularRoiSchema = z.object({
  descricao: z.string().min(3).max(200),
  tenantId: z.string().min(1).max(80),
  investimentoInicial: z.number().positive(),
  fluxosCaixa: z.array(fluxoCaixaSchema).min(1).max(50),
  taxaDesconto: z.number().min(0).max(2),
  projetoId: z.string().max(80).optional(),
});

// ─── POST /calcular-bdi ───────────────────────────────────────────────────────

router.post("/calcular-bdi", (req: Request, res: Response) => {
  const parse = calcularBdiSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const resultado = BdiRoiService.calcularBdi(parse.data);
  return res.status(201).json(resultado);
});

// ─── GET /analises-bdi ────────────────────────────────────────────────────────

router.get("/analises-bdi", (req: Request, res: Response) => {
  const tenantId = z.string().min(1).max(80).safeParse(req.query.tenantId);
  if (!tenantId.success) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = BdiRoiService.listarAnalisesBdi(tenantId.data);
  return res.json({ total: lista.length, analises: lista });
});

// ─── GET /analises-bdi/:id ────────────────────────────────────────────────────

router.get("/analises-bdi/:id", (req: Request, res: Response) => {
  const analise = BdiRoiService.obterAnaliseBdi(req.params.id);
  if (!analise) return res.status(404).json({ erro: "Análise não encontrada" });
  return res.json(analise);
});

// ─── GET /referencias ─────────────────────────────────────────────────────────

router.get("/referencias", (req: Request, res: Response) => {
  const tipoObraRes = tipoObraEnum.optional().safeParse(req.query.tipoObra);
  if (!tipoObraRes.success) return res.status(400).json({ erro: "tipoObra inválido" });
  const refs = BdiRoiService.listarReferenciais(tipoObraRes.data);
  return res.json({ total: refs.length, referencias: refs });
});

// ─── POST /calcular-roi ───────────────────────────────────────────────────────

router.post("/calcular-roi", (req: Request, res: Response) => {
  const parse = calcularRoiSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const resultado = BdiRoiService.calcularRoi(parse.data);
  return res.status(201).json(resultado);
});

// ─── GET /analises-roi ────────────────────────────────────────────────────────

router.get("/analises-roi", (req: Request, res: Response) => {
  const tenantId = z.string().min(1).max(80).safeParse(req.query.tenantId);
  if (!tenantId.success) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = BdiRoiService.listarAnalisesRoi(tenantId.data);
  return res.json({ total: lista.length, analises: lista });
});

// ─── GET /analises-roi/:id ────────────────────────────────────────────────────

router.get("/analises-roi/:id", (req: Request, res: Response) => {
  const analise = BdiRoiService.obterAnaliseRoi(req.params.id);
  if (!analise) return res.status(404).json({ erro: "Análise não encontrada" });
  return res.json(analise);
});

export default router;
