/**
 * lccRoutes.ts — Rotas LCC (Life Cycle Cost) (T2-44).
 * Prefixo: /api/lcc
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { LccService } from "../services/lccService.js";

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const categoriaCustoEnum = z.enum([
  "aquisicao", "instalacao", "operacao", "manutencao", "retrofit", "descarte",
]);

const entradaCustoSchema = z.object({
  ano: z.number().int().min(0).max(60),
  categoria: categoriaCustoEnum,
  valorNominal: z.number().nonnegative(),
  descricao: z.string().max(200).optional(),
});

const criarAnaliseSchema = z.object({
  nome: z.string().min(2).max(150),
  tenantId: z.string().min(1).max(80),
  taxaDesconto: z.number().min(0).max(1),
  horizonte: z.number().int().min(1).max(60),
  descricao: z.string().max(500).optional(),
  projetoId: z.string().max(80).optional(),
});

const adicionarAtivoSchema = z.object({
  descricao: z.string().min(2).max(200),
  tipo: z.string().min(1).max(80),
  quantidade: z.number().positive().int(),
  vidaUtilAnos: z.number().int().min(1).max(60),
  custos: z.array(entradaCustoSchema).min(1).max(100),
});

// ─── POST /analises ───────────────────────────────────────────────────────────

router.post("/analises", (req: Request, res: Response) => {
  const parse = criarAnaliseSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const analise = LccService.criarAnalise(parse.data);
  return res.status(201).json(analise);
});

// ─── GET /analises ────────────────────────────────────────────────────────────

router.get("/analises", (req: Request, res: Response) => {
  const tenantId = z.string().min(1).max(80).safeParse(req.query.tenantId);
  if (!tenantId.success) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = LccService.listarAnalises(tenantId.data);
  return res.json({ total: lista.length, analises: lista });
});

// ─── GET /analises/:id ────────────────────────────────────────────────────────

router.get("/analises/:id", (req: Request, res: Response) => {
  const analise = LccService.obterAnalise(req.params.id);
  if (!analise) return res.status(404).json({ erro: "Análise não encontrada" });
  return res.json(analise);
});

// ─── POST /analises/:id/ativos ────────────────────────────────────────────────

router.post("/analises/:id/ativos", (req: Request, res: Response) => {
  const parse = adicionarAtivoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const analise = LccService.adicionarAtivo(req.params.id, parse.data);
  if (!analise) return res.status(404).json({ erro: "Análise não encontrada" });
  return res.status(201).json(analise);
});

// ─── POST /analises/:id/calcular ──────────────────────────────────────────────

router.post("/analises/:id/calcular", (req: Request, res: Response) => {
  const analise = LccService.calcularLcc(req.params.id);
  if (!analise) return res.status(422).json({ erro: "Análise não encontrada ou sem ativos" });
  return res.json(analise);
});

// ─── POST /analises/:id/aprovar ───────────────────────────────────────────────

router.post("/analises/:id/aprovar", (req: Request, res: Response) => {
  const analise = LccService.aprovarAnalise(req.params.id);
  if (!analise) return res.status(422).json({ erro: "Análise não encontrada ou não calculada" });
  return res.json(analise);
});

// ─── POST /comparar ───────────────────────────────────────────────────────────

router.post("/comparar", (req: Request, res: Response) => {
  const parse = z.object({ idA: z.string().min(1), idB: z.string().min(1) }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "idA e idB obrigatórios" });
  const comp = LccService.compararAnalises(parse.data.idA, parse.data.idB);
  if (!comp) return res.status(422).json({ erro: "Análises não encontradas ou não calculadas" });
  return res.json(comp);
});

export default router;
