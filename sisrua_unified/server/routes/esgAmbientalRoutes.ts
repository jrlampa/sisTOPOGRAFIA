/**
 * esgAmbientalRoutes.ts — Rotas ESG Ambiental (T2-45).
 * Prefixo: /api/esg-ambiental
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { EsgAmbientalService } from "../services/esgAmbientalService.js";

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const escopoEnum = z.enum(["escopo1", "escopo2", "escopo3"]);

const tipoEmissaoEnum = z.enum([
  "cabo_aluminio_nu",
  "cabo_multiplexado",
  "cabo_protegido",
  "poste_concreto",
  "poste_madeira_eucalipto",
  "transformador_oleo",
  "veiculo_trabalho_diesel",
  "energia_eletrica_grid",
]);

const statusChecklistEnum = z.enum(["conforme", "nao_conforme", "nao_aplicavel", "pendente"]);

const criarRelatorioSchema = z.object({
  nome: z.string().min(2).max(150),
  tenantId: z.string().min(1).max(80),
  periodoReferencia: z.string().regex(/^\d{4}(-\d{2})?$/, "Formato YYYY ou YYYY-MM"),
  descricao: z.string().max(500).optional(),
  projetoId: z.string().max(80).optional(),
});

const entradaEmissaoSchema = z.object({
  tipo: tipoEmissaoEnum,
  escopo: escopoEnum,
  quantidade: z.number().nonnegative(),
  descricao: z.string().max(200).optional(),
});

const indicadoresSchema = z.object({
  percentualRedeProtegida: z.number().min(0).max(100),
  percentualPerdasTecnicas: z.number().min(0).max(100),
  indiceConflitosArborizacao: z.number().nonnegative(),
  percentualLuminariasLed: z.number().min(0).max(100),
  capacidadePanelSolar: z.number().nonnegative().optional(),
});

const atualizarChecklistSchema = z.object({
  itens: z.array(
    z.object({
      id: z.string().min(1),
      status: statusChecklistEnum,
      evidencia: z.string().max(300).optional(),
    })
  ).min(1).max(20),
});

// ─── POST /relatorios ─────────────────────────────────────────────────────────

router.post("/relatorios", (req: Request, res: Response) => {
  const parse = criarRelatorioSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const rel = EsgAmbientalService.criarRelatorio(parse.data);
  return res.status(201).json(rel);
});

// ─── GET /relatorios ──────────────────────────────────────────────────────────

router.get("/relatorios", (req: Request, res: Response) => {
  const tenantId = z.string().min(1).max(80).safeParse(req.query.tenantId);
  if (!tenantId.success) return res.status(400).json({ erro: "tenantId obrigatório" });
  const lista = EsgAmbientalService.listarRelatorios(tenantId.data);
  return res.json({ total: lista.length, relatorios: lista });
});

// ─── GET /relatorios/:id ──────────────────────────────────────────────────────

router.get("/relatorios/:id", (req: Request, res: Response) => {
  const rel = EsgAmbientalService.obterRelatorio(req.params.id);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── POST /relatorios/:id/emissoes ────────────────────────────────────────────

router.post("/relatorios/:id/emissoes", (req: Request, res: Response) => {
  const parse = z.object({
    emissoes: z.array(entradaEmissaoSchema).min(1).max(100),
  }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const rel = EsgAmbientalService.adicionarEmissoes(req.params.id, parse.data.emissoes);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── PUT /relatorios/:id/indicadores ─────────────────────────────────────────

router.put("/relatorios/:id/indicadores", (req: Request, res: Response) => {
  const parse = indicadoresSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const rel = EsgAmbientalService.atualizarIndicadores(req.params.id, parse.data);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── PATCH /relatorios/:id/checklist ─────────────────────────────────────────

router.patch("/relatorios/:id/checklist", (req: Request, res: Response) => {
  const parse = atualizarChecklistSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Payload inválido", detalhes: parse.error.issues });
  const rel = EsgAmbientalService.atualizarChecklist(req.params.id, parse.data.itens);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── POST /relatorios/:id/calcular ────────────────────────────────────────────

router.post("/relatorios/:id/calcular", (req: Request, res: Response) => {
  const rel = EsgAmbientalService.calcularRelatorio(req.params.id);
  if (!rel) return res.status(404).json({ erro: "Relatório não encontrado" });
  return res.json(rel);
});

// ─── POST /relatorios/:id/publicar ────────────────────────────────────────────

router.post("/relatorios/:id/publicar", (req: Request, res: Response) => {
  const rel = EsgAmbientalService.publicarRelatorio(req.params.id);
  if (!rel) return res.status(422).json({ erro: "Relatório não encontrado ou não calculado" });
  return res.json(rel);
});

// ─── GET /fatores-emissao ─────────────────────────────────────────────────────

router.get("/fatores-emissao", (_req: Request, res: Response) => {
  return res.json({ fatores: EsgAmbientalService.listarFatoresEmissao() });
});

export default router;
