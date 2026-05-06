/**
 * finOpsRoutes.ts — Rotas de FinOps (Item 130 [T1]).
 *
 * GET  /api/finops/resumo     — resumo geral
 * POST /api/finops/custos     — registra custo
 * GET  /api/finops/consumo    — consumo mensal (query: ano, mes)
 * PUT  /api/finops/orcamento  — define orçamento por ambiente
 * GET  /api/finops/alertas    — alertas de orçamento (query: ano, mes)
 *
 * Auth: METRICS_TOKEN (Bearer)
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  isBearerRequestAuthorized,
  setBearerChallenge,
} from "../utils/bearerAuth.js";
import {
  registrarCusto,
  definirOrcamento,
  consumoMensalPorAmbiente,
  alertasOrcamento,
  resumoFinOps,
  AmbienteFinOps,
  CategoriaFinOps,
  OrcamentoAmbiente,
} from "../services/finOpsService.js";

const router = Router();
const AMBIENTES: AmbienteFinOps[] = ["dev", "homolog", "producao"];
const CATEGORIAS: CategoriaFinOps[] = [
  "api_externa",
  "processamento",
  "armazenamento",
  "exportacao",
];

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "finops");
  return res.status(401).json({ erro: "Não autorizado" });
}

const CustoSchema = z.object({
  ambiente: z.enum(AMBIENTES as [AmbienteFinOps, ...AmbienteFinOps[]]),
  categoria: z.enum(CATEGORIAS as [CategoriaFinOps, ...CategoriaFinOps[]]),
  tenantId: z.string().max(128).optional(),
  valorUsd: z.number().positive(),
  descricao: z.string().min(1).max(512),
});

const OrcamentoSchema = z.object({
  ambiente: z.enum(AMBIENTES as [AmbienteFinOps, ...AmbienteFinOps[]]),
  limiteMensalUsd: z.number().positive(),
  alertaPct: z.number().min(0).max(100),
});

const PeriodoSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

router.get("/resumo", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  return res.json(resumoFinOps());
});

router.post("/custos", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = CustoSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  const registro = registrarCusto(parsed.data);
  logger.info("[FinOpsRoutes] Custo registrado", {
    id: registro.id,
    ambiente: registro.ambiente,
    valorUsd: registro.valorUsd,
  });
  return res.status(201).json(registro);
});

router.get("/consumo", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const q = PeriodoSchema.safeParse(req.query);
  if (!q.success)
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: q.error.issues });

  const consumo = consumoMensalPorAmbiente(q.data.ano, q.data.mes);
  return res.json({ ano: q.data.ano, mes: q.data.mes, consumo });
});

router.put("/orcamento", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const parsed = OrcamentoSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: parsed.error.issues });

  definirOrcamento(parsed.data as OrcamentoAmbiente);
  return res.json({ sucesso: true, orcamento: parsed.data });
});

router.get("/alertas", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);
  const q = PeriodoSchema.safeParse(req.query);
  if (!q.success)
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: q.error.issues });

  const alertas = alertasOrcamento(q.data.ano, q.data.mes);
  return res.json({ ano: q.data.ano, mes: q.data.mes, alertas });
});

export default router;
