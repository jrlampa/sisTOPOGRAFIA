/**
 * vegetacaoInventarioRoutes.ts — Rotas para Inventário de Vegetação Simulado (T2-46).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  VegetacaoInventarioService,
  TipologiaVegetacao,
  StatusConservacao,
} from "../services/vegetacaoInventarioService.js";

const router = Router();

// Schemas de validação
const tipologiasValidas: [TipologiaVegetacao, ...TipologiaVegetacao[]] = [
  "floresta_amazonica",
  "floresta_atlantica",
  "cerrado",
  "mata_ciliar",
  "vegetacao_secundaria",
  "campo_cerrado",
];

const statusConservacaoValidos: [StatusConservacao, ...StatusConservacao[]] = [
  "primaria",
  "secundaria_avancada",
  "secundaria_inicial",
  "degradada",
];

const criarInventarioSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(1),
  projetoId: z.string().optional(),
  descricao: z.string().optional(),
});

const adicionarUnidadeSchema = z.object({
  tipologia: z.enum(tipologiasValidas),
  statusConservacao: z.enum(statusConservacaoValidos),
  areaHectares: z.number().positive(),
  municipio: z.string().optional(),
  uf: z.string().length(2).optional(),
  descricao: z.string().optional(),
});

// ─── POST /inventarios ────────────────────────────────────────────────────────
router.post("/inventarios", (req: Request, res: Response) => {
  const parse = criarInventarioSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const inventario = VegetacaoInventarioService.criarInventario(parse.data);
  return res.status(201).json(inventario);
});

// ─── GET /inventarios?tenantId= ───────────────────────────────────────────────
router.get("/inventarios", (req: Request, res: Response) => {
  const tenantId = req.query["tenantId"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ erro: "Parâmetro tenantId obrigatório" });
  }
  return res.json(VegetacaoInventarioService.listarInventarios(tenantId));
});

// ─── GET /inventarios/:id ─────────────────────────────────────────────────────
router.get("/inventarios/:id", (req: Request, res: Response) => {
  const inv = VegetacaoInventarioService.obterInventario(req.params["id"]!);
  if (!inv) return res.status(404).json({ erro: "Inventário não encontrado" });
  return res.json(inv);
});

// ─── POST /inventarios/:id/unidades ──────────────────────────────────────────
router.post("/inventarios/:id/unidades", (req: Request, res: Response) => {
  const parse = adicionarUnidadeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: parse.error.flatten() });
  }
  const inv = VegetacaoInventarioService.adicionarUnidade(req.params["id"]!, parse.data);
  if (!inv) return res.status(404).json({ erro: "Inventário não encontrado" });
  return res.status(201).json(inv);
});

// ─── POST /inventarios/:id/calcular ──────────────────────────────────────────
router.post("/inventarios/:id/calcular", (req: Request, res: Response) => {
  const resultado = VegetacaoInventarioService.calcularSupressao(req.params["id"]!);
  if ("erro" in resultado) {
    return res.status(422).json(resultado);
  }
  return res.json(resultado);
});

// ─── POST /inventarios/:id/aprovar ───────────────────────────────────────────
router.post("/inventarios/:id/aprovar", (req: Request, res: Response) => {
  const inv = VegetacaoInventarioService.aprovarInventario(req.params["id"]!);
  if (!inv) {
    return res.status(422).json({ erro: "Inventário não encontrado ou status não permite aprovação" });
  }
  return res.json(inv);
});

// ─── GET /tipologias ─────────────────────────────────────────────────────────
router.get("/tipologias", (_req: Request, res: Response) => {
  return res.json(VegetacaoInventarioService.listarTipologias());
});

export default router;
