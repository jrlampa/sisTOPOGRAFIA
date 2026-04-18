/**
 * businessKpiRoutes.ts — Rotas de Observabilidade de Negócio (KPIs Operacionais).
 *
 * Roadmap Item 125 [T1]: Observabilidade de Negócio (KPIs Operacionais).
 * Taxa de sucesso por projeto/região, retrabalho e gargalos regionais.
 *
 * Autenticação:
 *   - Escrita (POST) exige METRICS_TOKEN (mesmo token dos outros endpoints admin).
 *   - Leitura (GET) também exige METRICS_TOKEN (dado operacional sensível).
 *
 * Endpoints:
 *   GET  /api/business-kpi/:tenantId/relatorio         — relatório KPI completo
 *   GET  /api/business-kpi/:tenantId/eventos           — lista de eventos com filtros
 *   GET  /api/business-kpi/:tenantId/gargalos          — apenas gargalos regionais
 *   POST /api/business-kpi/:tenantId/eventos           — registra evento de KPI
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
  registrarEventoKpi,
  listarEventosKpi,
  relatorioKpiTenant,
  TipoOperacao,
  ResultadoJob,
} from "../services/businessKpiService.js";
import {
  registrarEventoFluxoCritico,
  EtapaFluxoCritico,
} from "../services/criticalFlowContractService.js";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

function unauthorized(res: Response): Response {
  setBearerChallenge(res, "business-kpi");
  return res.status(401).json({ erro: "Não autorizado" });
}

function forbidden(res: Response): Response {
  return res.status(403).json({
    erro: "Acesso proibido para o fluxo crítico",
    code: "FORBIDDEN_SCOPE",
  });
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TIPOS_OP: TipoOperacao[] = [
  "exportacao_dxf",
  "analise_rede",
  "calculo_bt",
  "calculo_cqt",
  "snapshot_dominio",
  "relatorio",
];

const RESULTADOS: ResultadoJob[] = ["sucesso", "falha", "retrabalho"];

const TenantParamSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[\w.@-]+$/, "tenantId inválido")
    .refine((v) => !v.includes(".."), "tenantId não pode conter '..'"),
});

const PeriodoQuerySchema = z.object({
  de: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
  tipo: z.enum(TIPOS_OP as [TipoOperacao, ...TipoOperacao[]]).optional(),
  resultado: z.enum(RESULTADOS as [ResultadoJob, ...ResultadoJob[]]).optional(),
  regiao: z.string().max(128).optional(),
  projetoId: z.string().max(128).optional(),
});

const RegistrarEventoSchema = z.object({
  tipo: z.enum(TIPOS_OP as [TipoOperacao, ...TipoOperacao[]]),
  resultado: z.enum(RESULTADOS as [ResultadoJob, ...ResultadoJob[]]),
  duracaoMs: z.number().finite().min(0),
  projetoId: z.string().max(128).optional(),
  regiao: z.string().max(128).optional(),
  metadados: z.record(z.unknown()).optional(),
});

const ETAPAS_FLUXO_CRITICO: EtapaFluxoCritico[] = [
  "projeto",
  "ponto",
  "persistido",
  "snapshot",
];

const RegistrarFluxoCriticoSchema = z
  .object({
    etapa: z.enum(
      ETAPAS_FLUXO_CRITICO as [EtapaFluxoCritico, ...EtapaFluxoCritico[]],
    ),
    projetoId: z.string().trim().min(1).max(128),
    pontoId: z.string().trim().min(1).max(128).optional(),
    metadados: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.etapa !== "projeto" && !value.pontoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pontoId"],
        message: "pontoId é obrigatório para etapa diferente de projeto",
      });
    }
  });

// ─── GET /:tenantId/relatorio — relatório KPI completo ────────────────────────

router.get("/:tenantId/relatorio", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);

  const p = TenantParamSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }

  const q = z
    .object({
      de: z.string().datetime().optional(),
      ate: z.string().datetime().optional(),
    })
    .safeParse(req.query);
  if (!q.success) {
    return res.status(400).json({
      erro: "Parâmetros de período inválidos",
      detalhes: q.error.issues,
    });
  }

  const relatorio = relatorioKpiTenant(
    p.data.tenantId,
    q.data.de ? new Date(q.data.de) : undefined,
    q.data.ate ? new Date(q.data.ate) : undefined,
  );
  return res.json(relatorio);
});

// ─── GET /:tenantId/gargalos — apenas gargalos regionais ─────────────────────

router.get("/:tenantId/gargalos", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);

  const p = TenantParamSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }

  const relatorio = relatorioKpiTenant(p.data.tenantId);
  const apenasGargalos = req.query["apenasGargalos"] === "true";
  const gargalos = apenasGargalos
    ? relatorio.gargalosRegionais.filter((g) => g.ehGargalo)
    : relatorio.gargalosRegionais;

  return res.json({
    tenantId: p.data.tenantId,
    totalRegioes: relatorio.gargalosRegionais.length,
    gargalosRegionais: gargalos,
  });
});

// ─── GET /:tenantId/eventos — lista eventos com filtros ───────────────────────

router.get("/:tenantId/eventos", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);

  const p = TenantParamSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }

  const q = PeriodoQuerySchema.safeParse(req.query);
  if (!q.success) {
    return res
      .status(400)
      .json({ erro: "Filtros inválidos", detalhes: q.error.issues });
  }

  const { de, ate, tipo, resultado, regiao, projetoId } = q.data;
  const eventos = listarEventosKpi(p.data.tenantId, {
    de: de ? new Date(de) : undefined,
    ate: ate ? new Date(ate) : undefined,
    tipo,
    resultado,
    regiao,
    projetoId,
  });

  return res.json({
    tenantId: p.data.tenantId,
    total: eventos.length,
    eventos,
  });
});

// ─── POST /:tenantId/eventos — registra evento de KPI ────────────────────────

router.post("/:tenantId/eventos", (req: Request, res: Response) => {
  if (!isAuthorized(req)) return unauthorized(res);

  const p = TenantParamSchema.safeParse(req.params);
  if (!p.success) {
    return res
      .status(400)
      .json({ erro: "tenantId inválido", detalhes: p.error.issues });
  }

  const b = RegistrarEventoSchema.safeParse(req.body);
  if (!b.success) {
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: b.error.issues });
  }

  try {
    const evento = registrarEventoKpi(
      p.data.tenantId,
      b.data.tipo,
      b.data.resultado,
      b.data.duracaoMs,
      {
        projetoId: b.data.projetoId,
        regiao: b.data.regiao,
        metadados: b.data.metadados,
      },
    );

    logger.info("[BusinessKpiRoutes] Evento KPI registrado", {
      tenantId: p.data.tenantId,
      tipo: evento.tipo,
      resultado: evento.resultado,
      duracaoMs: evento.duracaoMs,
    });

    return res.status(201).json(evento);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ erro: msg });
  }
});

// ─── POST /:tenantId/fluxo-critico/eventos — contrato API-E2E oficial ──────

router.post(
  "/:tenantId/fluxo-critico/eventos",
  (req: Request, res: Response) => {
    if (!isAuthorized(req)) return unauthorized(res);

    // 403: token válido, mas sem escopo explícito para escrita de contrato crítico.
    const scope = req.headers["x-contract-scope"];
    if (scope !== "critical-flow:write") {
      return forbidden(res);
    }

    const p = TenantParamSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(422).json({
        erro: "Parâmetros inválidos para fluxo crítico",
        detalhes: p.error.issues,
      });
    }

    const b = RegistrarFluxoCriticoSchema.safeParse(req.body);
    if (!b.success) {
      return res.status(422).json({
        erro: "Payload inválido para fluxo crítico",
        detalhes: b.error.issues,
      });
    }

    const result = registrarEventoFluxoCritico({
      tenantId: p.data.tenantId,
      projetoId: b.data.projetoId,
      pontoId: b.data.pontoId,
      etapa: b.data.etapa,
      metadados: b.data.metadados,
      ocorridoEm: new Date(),
    });

    return res.status(result.status).json({
      ok: result.status === 200,
      ...result,
    });
  },
);

export default router;
