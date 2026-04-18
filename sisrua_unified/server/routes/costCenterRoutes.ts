/**
 * costCenterRoutes.ts — Rotas de Gestão de Centros de Custo por Tenant.
 *
 * Roadmap Item 36 [T2]: Gestão de Centros de Custo.
 * Alocação de custos de processamento e projetos por área de negócio.
 *
 * Autenticação:
 *   - Escrita (POST, PATCH, DELETE) exige METRICS_TOKEN.
 *   - Leitura (GET) é pública (informação operacional).
 *
 * Endpoints:
 *   GET    /api/cost-centers/:tenantId                      — lista CCs do tenant
 *   GET    /api/cost-centers/:tenantId/:ccId                — detalhe do CC
 *   GET    /api/cost-centers/:tenantId/:ccId/registros      — lista registros
 *   GET    /api/cost-centers/:tenantId/relatorio            — relatório consolidado
 *   POST   /api/cost-centers/:tenantId                      — cria CC (admin)
 *   PATCH  /api/cost-centers/:tenantId/:ccId                — atualiza CC (admin)
 *   POST   /api/cost-centers/:tenantId/:ccId/registros      — imputa custo (admin)
 *   DELETE /api/cost-centers/:tenantId/:ccId                — desativa CC (admin)
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
  criarCentroCusto,
  atualizarCentroCusto,
  getCentroCusto,
  listarCentrosCusto,
  desativarCentroCusto,
  registrarCusto,
  listarRegistros,
  relatorioTenantCusto,
  TipoCusto,
} from "../services/costCenterService.js";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "cost-centers-admin");
  return res.status(401).json({ erro: "Não autorizado" });
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TIPOS_CUSTO: TipoCusto[] = [
  "processamento",
  "armazenamento",
  "exportacao_dxf",
  "analise_rede",
  "api_externa",
];

const TenantIdSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[\w.@-]+$/, "tenantId inválido")
    .refine((v) => !v.includes(".."), "tenantId não pode conter '..'"),
});

const CcIdSchema = z.object({
  ccId: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9\-_]+$/,
      "ccId deve conter apenas letras minúsculas, números, hífens ou underscores",
    ),
});

const CriarCCSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9\-_]+$/, "id inválido para centro de custo"),
  nome: z.string().min(1).max(200),
  descricao: z.string().max(500).optional(),
});

const AtualizarCCSchema = z
  .object({
    nome: z.string().min(1).max(200).optional(),
    descricao: z.string().max(500).optional(),
    ativo: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nenhum campo para atualizar");

const RegistrarCustoSchema = z.object({
  tipo: z.enum(TIPOS_CUSTO as [TipoCusto, ...TipoCusto[]]),
  valor: z.number().finite().min(0),
  descricao: z.string().min(1).max(500),
  metadados: z.record(z.unknown()).optional(),
});

const FiltroRegistrosSchema = z.object({
  tipo: z.enum(TIPOS_CUSTO as [TipoCusto, ...TipoCusto[]]).optional(),
  de: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
});

// ─── GET /:tenantId — lista CCs ───────────────────────────────────────────────

router.get("/:tenantId", (req: Request, res: Response) => {
  const p = TenantIdSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }
  const apenasAtivos = req.query["apenasAtivos"] === "true";
  const lista = listarCentrosCusto(p.data.tenantId, apenasAtivos);
  return res.json({ tenantId: p.data.tenantId, centros: lista });
});

// ─── GET /:tenantId/relatorio — relatório consolidado ─────────────────────────

router.get("/:tenantId/relatorio", (req: Request, res: Response) => {
  const p = TenantIdSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }
  const relatorio = relatorioTenantCusto(p.data.tenantId);
  return res.json(relatorio);
});

// ─── GET /:tenantId/:ccId — detalhe do CC ─────────────────────────────────────

router.get("/:tenantId/:ccId", (req: Request, res: Response) => {
  const p = TenantIdSchema.merge(CcIdSchema).safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: p.error.issues });
  }
  const cc = getCentroCusto(p.data.tenantId, p.data.ccId);
  if (!cc) {
    return res.status(404).json({ erro: "Centro de custo não encontrado" });
  }
  return res.json(cc);
});

// ─── GET /:tenantId/:ccId/registros — lista registros ────────────────────────

router.get("/:tenantId/:ccId/registros", (req: Request, res: Response) => {
  const p = TenantIdSchema.merge(CcIdSchema).safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: p.error.issues });
  }
  const filtro = FiltroRegistrosSchema.safeParse(req.query);
  if (!filtro.success) {
    return res
      .status(400)
      .json({ erro: "Filtros inválidos", detalhes: filtro.error.issues });
  }

  const { tipo, de, ate } = filtro.data;
  const registros = listarRegistros(p.data.tenantId, p.data.ccId, {
    tipo,
    de: de ? new Date(de) : undefined,
    ate: ate ? new Date(ate) : undefined,
  });
  return res.json({ tenantId: p.data.tenantId, ccId: p.data.ccId, registros });
});

// ─── POST /:tenantId — cria CC (admin) ────────────────────────────────────────

router.post("/:tenantId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return unauthorized(res);

  const p = TenantIdSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }
  const b = CriarCCSchema.safeParse(req.body);
  if (!b.success) {
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: b.error.issues });
  }

  try {
    const cc = criarCentroCusto(
      p.data.tenantId,
      b.data.id,
      b.data.nome,
      b.data.descricao,
    );
    logger.info("[CostCenterRoutes] Centro de custo criado", {
      tenantId: p.data.tenantId,
      ccId: cc.id,
    });
    return res.status(201).json(cc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(409).json({ erro: msg });
  }
});

// ─── PATCH /:tenantId/:ccId — atualiza CC (admin) ─────────────────────────────

router.patch("/:tenantId/:ccId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return unauthorized(res);

  const p = TenantIdSchema.merge(CcIdSchema).safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: p.error.issues });
  }
  const b = AtualizarCCSchema.safeParse(req.body);
  if (!b.success) {
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: b.error.issues });
  }

  try {
    const cc = atualizarCentroCusto(p.data.tenantId, p.data.ccId, b.data);
    if (!cc) {
      return res.status(404).json({ erro: "Centro de custo não encontrado" });
    }
    logger.info("[CostCenterRoutes] Centro de custo atualizado", {
      tenantId: p.data.tenantId,
      ccId: p.data.ccId,
    });
    return res.json(cc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ erro: msg });
  }
});

// ─── POST /:tenantId/:ccId/registros — imputa custo (admin) ──────────────────

router.post("/:tenantId/:ccId/registros", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return unauthorized(res);

  const p = TenantIdSchema.merge(CcIdSchema).safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: p.error.issues });
  }
  const b = RegistrarCustoSchema.safeParse(req.body);
  if (!b.success) {
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: b.error.issues });
  }

  try {
    const registro = registrarCusto(
      p.data.tenantId,
      p.data.ccId,
      b.data.tipo,
      b.data.valor,
      b.data.descricao,
      b.data.metadados,
    );
    logger.info("[CostCenterRoutes] Custo imputado", {
      tenantId: p.data.tenantId,
      ccId: p.data.ccId,
      tipo: b.data.tipo,
      valor: b.data.valor,
    });
    return res.status(201).json(registro);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg.includes("não encontrado") || msg.includes("inativo") ? 422 : 400;
    return res.status(status).json({ erro: msg });
  }
});

// ─── DELETE /:tenantId/:ccId — desativa CC (admin) ───────────────────────────

router.delete("/:tenantId/:ccId", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return unauthorized(res);

  const p = TenantIdSchema.merge(CcIdSchema).safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "Parâmetros inválidos", detalhes: p.error.issues });
  }

  const desativado = desativarCentroCusto(p.data.tenantId, p.data.ccId);
  if (!desativado) {
    return res.status(404).json({ erro: "Centro de custo não encontrado" });
  }

  logger.info("[CostCenterRoutes] Centro de custo desativado", {
    tenantId: p.data.tenantId,
    ccId: p.data.ccId,
  });
  return res.json({
    tenantId: p.data.tenantId,
    ccId: p.data.ccId,
    mensagem: "Centro de custo desativado com sucesso",
  });
});

export default router;
