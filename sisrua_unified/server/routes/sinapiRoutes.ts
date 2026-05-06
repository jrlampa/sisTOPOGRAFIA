/**
 * sinapiRoutes.ts — Rotas SINAPI/ORSE (T2-42).
 * Prefixo: /api/sinapi
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { SinapiService } from "../services/sinapiService.js";

const router = Router();

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const categoriaEnum = z.enum([
  "postes_estruturas",
  "cabos_condutores",
  "transformadores",
  "medicao_protecao",
  "iluminacao_publica",
  "servicos_eletricos",
  "obras_civis",
  "equipamentos_gerais",
]);

const fonteEnum = z.enum(["SINAPI", "ORSE"]);

const ufEnum = z.enum([
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO", "BR",
]);

const catalogoQuerySchema = z.object({
  categoria: categoriaEnum.optional(),
  fonte: fonteEnum.optional(),
  uf: ufEnum.optional(),
  busca: z.string().max(120).optional(),
});

const itemOrcamentoSchema = z.object({
  codigoSinapi: z.string().min(1).max(30),
  quantidade: z.number().positive(),
  precoUnitarioAplicado: z.number().positive().optional(),
  observacao: z.string().max(300).optional(),
});

const gerarOrcamentoSchema = z.object({
  descricao: z.string().min(3).max(200),
  tenantId: z.string().min(1).max(80),
  uf: ufEnum.exclude(["BR"]),
  itens: z.array(itemOrcamentoSchema).min(1).max(200),
  projetoId: z.string().max(80).optional(),
});

const statusOrcamentoSchema = z.object({
  status: z.enum(["rascunho", "validado", "aprovado"]),
});

// ─── GET /catalogo ────────────────────────────────────────────────────────────

router.get("/catalogo", (req: Request, res: Response) => {
  const parse = catalogoQuerySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ erro: "Parâmetros inválidos", detalhes: parse.error.issues });
  const itens = SinapiService.listarCatalogo(parse.data);
  return res.json({ total: itens.length, itens });
});

// ─── GET /catalogo/:codigo ────────────────────────────────────────────────────

router.get("/catalogo/:codigo", (req: Request, res: Response) => {
  const { codigo } = req.params;
  const item = SinapiService.obterItemPorCodigo(codigo);
  if (!item) return res.status(404).json({ erro: "Item não encontrado" });
  return res.json(item);
});

// ─── GET /categorias ─────────────────────────────────────────────────────────

router.get("/categorias", (_req: Request, res: Response) => {
  return res.json({ categorias: SinapiService.listarCategorias() });
});

// ─── POST /orcamento ──────────────────────────────────────────────────────────

router.post("/orcamento", (req: Request, res: Response) => {
  const parse = gerarOrcamentoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });

  const resultado = SinapiService.gerarOrcamento(parse.data);
  if ("erro" in resultado) return res.status(422).json(resultado);
  return res.status(201).json(resultado);
});

// ─── GET /orcamentos ──────────────────────────────────────────────────────────

router.get("/orcamentos", (req: Request, res: Response) => {
  const tenantId = z.string().min(1).max(80).safeParse(req.query.tenantId);
  if (!tenantId.success) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = SinapiService.listarOrcamentos(tenantId.data);
  return res.json({ total: lista.length, orcamentos: lista });
});

// ─── GET /orcamento/:id ───────────────────────────────────────────────────────

router.get("/orcamento/:id", (req: Request, res: Response) => {
  const orc = SinapiService.obterOrcamento(req.params.id);
  if (!orc) return res.status(404).json({ erro: "Orçamento não encontrado" });
  return res.json(orc);
});

// ─── PATCH /orcamento/:id/status ─────────────────────────────────────────────

router.patch("/orcamento/:id/status", (req: Request, res: Response) => {
  const parse = statusOrcamentoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const orc = SinapiService.atualizarStatusOrcamento(req.params.id, parse.data.status);
  if (!orc) return res.status(404).json({ erro: "Orçamento não encontrado" });
  return res.json(orc);
});

export default router;
