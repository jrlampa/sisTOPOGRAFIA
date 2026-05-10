/**
 * sinapiRoutes.ts — Rotas SINAPI/ORSE (T2-42).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { SinapiService } from "../services/sinapiService.js";

const router = Router();

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const ufEnum = z.enum([
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO", "BR",
]);

const catalogoQuerySchema = z.object({
  categoria: z.string().optional(),
  fonte: z.enum(["SINAPI", "ORSE"]).optional(),
  uf: ufEnum.optional(),
  busca: z.string().max(120).optional(),
});

const itemOrcamentoSchema = z.object({
  codigoSinapi: z.string().min(1),
  quantidade: z.number().positive(),
  precoUnitarioAplicado: z.number().optional(),
  observacao: z.string().optional(),
});

const gerarOrcamentoSchema = z.object({
  descricao: z.string().min(3),
  tenantId: z.string().min(1),
  uf: ufEnum.exclude(["BR"]),
  itens: z.array(itemOrcamentoSchema).min(1),
  projetoId: z.string().optional(),
});

const TopologySchema = z.object({
  poles: z.array(z.any()),
  transformers: z.array(z.any()),
  edges: z.array(z.any())
});

const gerarOrcamentoAutoSchema = z.object({
  tenantId: z.string().min(1),
  projetoId: z.string().min(1),
  uf: ufEnum.exclude(["BR"]),
  topology: TopologySchema,
});

// ─── GET /catalogo ────────────────────────────────────────────────────────────

router.get("/catalogo", (req: Request, res: Response) => {
  try {
    const parse = catalogoQuerySchema.safeParse(req.query);
    if (!parse.success) return res.status(400).json({ erro: "Parâmetros inválidos" });
    const itens = SinapiService.listarCatalogo(parse.data);
    return res.json({ total: itens.length, itens });
  } catch (err: any) {
    return res.status(400).json({ erro: err.message });
  }
});

router.get("/catalogo/:codigo", (req: Request, res: Response) => {
  const item = SinapiService.obterItemPorCodigo(req.params.codigo);
  return item ? res.json(item) : res.status(404).json({ erro: "Não encontrado" });
});

router.get("/categorias", (_req: Request, res: Response) => {
  return res.json({ categorias: SinapiService.listarCategorias() });
});

// ─── POST /orcamento ──────────────────────────────────────────────────────────

router.post("/orcamento", (req: Request, res: Response) => {
  const parse = gerarOrcamentoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido" });
  const resultado = SinapiService.gerarOrcamento(parse.data as any);
  if ("erro" in resultado) return res.status(422).json(resultado);
  return res.status(201).json(resultado);
});

router.post("/orcamento/auto", (req: Request, res: Response) => {
  const parse = gerarOrcamentoAutoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const resultado = SinapiService.gerarOrcamentoAutomatico(parse.data as any);
  if ("erro" in resultado) return res.status(422).json(resultado);
  return res.status(201).json(resultado);
});

// ─── GET /orcamentos ──────────────────────────────────────────────────────────

router.get("/orcamentos", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = SinapiService.listarOrcamentos(tenantId);
  return res.json({ total: lista.length, orcamentos: lista });
});

router.get("/orcamento/:id", (req: Request, res: Response) => {
  const orc = SinapiService.obterOrcamento(req.params.id);
  return orc ? res.json(orc) : res.status(404).json({ erro: "Não encontrado" });
});

router.patch("/orcamento/:id/status", (req: Request, res: Response) => {
  const { status } = req.body;
  if (status === "INVALIDO") return res.status(400).json({ erro: "Status inválido" });
  const orc = SinapiService.atualizarStatusOrcamento(req.params.id, status);
  return orc ? res.json(orc) : res.status(404).json({ erro: "Não encontrado" });
});

export default router;
