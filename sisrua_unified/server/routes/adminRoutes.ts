/**
 * adminRoutes.ts — Painel de Autoatendimento Administrativo.
 *
 * Roadmap Item 35 [T1]: Painel de Autoatendimento Administrativo.
 * Gestão de usuários e papéis pelos gestores do cliente.
 *
 * Também agrega, em leitura, dados dos outros domínios operacionais:
 *   - Item 30 [T1]: RBAC/ABAC — gestão de papéis
 *   - Item 32 [T1]: Isolamento Multi-tenant — gestão de tenants
 *   - Item 33 [T2]: Quotas por Tenant
 *   - Item 115 [T1]: Feature Flags por Tenant
 *
 * Autenticação: todos os endpoints exigem papel `admin` via ADMIN_TOKEN
 * (header `Authorization: Bearer <token>`).
 * Regra unificada para endpoints críticos: se token estiver configurado,
 * autenticação é obrigatória; sem token configurado, acesso é permissivo.
 *
 * Endpoints:
 *   GET  /api/admin/saude                 — health do painel admin
 *   GET  /api/admin/usuarios              — lista de usuários e seus papéis
 *   PUT  /api/admin/usuarios/:userId/papel — atribui papel a usuário
 *   GET  /api/admin/papeis/estatisticas   — distribuição de papéis
 *   GET  /api/admin/tenants               — lista de tenants ativos (via DB)
 *   GET  /api/admin/quotas                — visão geral de quotas configuradas
 *   GET  /api/admin/feature-flags         — visão geral de feature flags
 *   GET  /api/admin/kpis                  — resumo de KPIs globais por tenant
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  isBearerRequestAuthorized,
  setBearerChallenge,
} from "../utils/bearerAuth.js";
import { getDbClient } from "../repositories/dbClient.js";
import {
  getUsersByRole,
  setUserRole,
  getRoleStatistics,
  UserRole,
} from "../services/roleService.js";
import {
  getTenantQuotas,
  listarTenantComQuotas,
  TipoQuota,
  JANELA_QUOTA_MS,
} from "../services/tenantQuotaService.js";
import { getTenantFlagOverrides } from "../services/tenantFeatureFlagService.js";
import { relatorioKpiTenant } from "../services/businessKpiService.js";
import { getSystemHealthMvsReport } from "../services/systemHealthDashboardService.js";
import {
  listServiceProfiles,
  removeServiceProfile,
  upsertServiceProfile,
} from "../services/tenantServiceProfileService.js";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(
    req,
    config.ADMIN_TOKEN ?? config.METRICS_TOKEN,
  );
}

function forbidden(res: Response): Response {
  setBearerChallenge(res, "admin");
  return res.status(401).json({ erro: "Não autorizado" });
}

// ─── GET /saude ───────────────────────────────────────────────────────────────

router.get("/saude", (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  return res.json({
    painel: "Painel de Autoatendimento Administrativo",
    versao: config.APP_VERSION,
    status: "operacional",
    banco: getDbClient() !== null ? "disponível" : "indisponível",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /dashboard-mvs ───────────────────────────────────────────────────────

router.get("/dashboard-mvs", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  try {
    const report = await getSystemHealthMvsReport();
    if (!report) {
      return res.status(503).json({ erro: "Serviço de métricas indisponível no momento" });
    }
    return res.json(report);
  } catch (error) {
    logger.error("[AdminRoutes] Falha ao gerar dashboard MVs", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ erro: "Erro interno ao gerar dashboard de saúde" });
  }
});

// ─── GET /usuarios ────────────────────────────────────────────────────────────

router.get("/usuarios", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const papeis: UserRole[] = ["admin", "technician", "viewer"];
  const resultados: Array<{ userId: string; papel: UserRole }> = [];

  for (const papel of papeis) {
    const lista = await getUsersByRole(papel);
    for (const u of lista) {
      resultados.push({ userId: u.user_id, papel });
    }
  }

  return res.json({
    total: resultados.length,
    usuarios: resultados,
  });
});

// ─── PUT /usuarios/:userId/papel ──────────────────────────────────────────────

const AlterarPapelSchema = z.object({
  papel: z.enum(["admin", "technician", "viewer"]),
  motivo: z.string().max(500).optional(),
  atribuidoPor: z.string().min(1).max(128),
});

router.put("/usuarios/:userId/papel", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const userId = (req.params.userId ?? "").trim();
  if (!userId || userId.includes("..")) {
    return res.status(400).json({ erro: "userId inválido" });
  }

  const body = AlterarPapelSchema.safeParse(req.body);
  if (!body.success) {
    return res
      .status(400)
      .json({ erro: "Corpo inválido", detalhes: body.error.issues });
  }

  const sucesso = await setUserRole(
    userId,
    body.data.papel as UserRole,
    body.data.atribuidoPor,
    body.data.motivo,
  );

  if (!sucesso) {
    return res.status(500).json({
      erro: "Falha ao atualizar papel (banco indisponível ou usuário não encontrado)",
    });
  }

  logger.info("[AdminRoutes] Papel de usuário alterado", {
    userId,
    novoPapel: body.data.papel,
    atribuidoPor: body.data.atribuidoPor,
  });

  return res.json({ userId, papel: body.data.papel, atualizado: true });
});

// ─── GET /papeis/estatisticas ─────────────────────────────────────────────────

router.get("/papeis/estatisticas", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);
  const stats = await getRoleStatistics();
  return res.json({ distribuicao: stats });
});

// ─── GET /tenants ─────────────────────────────────────────────────────────────

router.get("/tenants", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const sql = getDbClient();
  if (!sql) {
    return res.json({
      total: 0,
      tenants: [],
      aviso: "Banco de dados indisponível",
    });
  }

  try {
    const rows = await sql<
      {
        id: string;
        slug: string;
        name: string;
        plan: string;
        is_active: boolean;
        created_at: string;
      }[]
    >`
      SELECT id, slug, name, plan, is_active, created_at
      FROM tenants
      WHERE is_active = TRUE
      ORDER BY name ASC
    `;

    return res.json({ total: rows.length, tenants: rows });
  } catch (err) {
    logger.error("[AdminRoutes] Falha ao listar tenants", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ erro: "Erro interno ao listar tenants" });
  }
});

// ─── GET /quotas ──────────────────────────────────────────────────────────────

router.get("/quotas", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const tenantId = (req.query.tenantId as string | undefined)?.trim();
  const tipos = Object.keys(JANELA_QUOTA_MS) as TipoQuota[];

  if (tenantId) {
    const quotas = getTenantQuotas(tenantId);
    return res.json({ tenantId, tipos, quotas });
  }

  const tenantsComQuotas = listarTenantComQuotas();
  return res.json({
    tipos,
    tenantsComQuotas,
    aviso:
      "Informe tenantId como query param para ver quotas de um tenant específico",
  });
});

// ─── GET /feature-flags ───────────────────────────────────────────────────────

router.get("/feature-flags", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const tenantId = (req.query.tenantId as string | undefined)?.trim();
  if (!tenantId) {
    return res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
  }

  const flags = getTenantFlagOverrides(tenantId);
  return res.json({ tenantId, total: Object.keys(flags).length, flags });
});

// ─── GET /kpis ────────────────────────────────────────────────────────────────

router.get("/kpis", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  const tenantId = (req.query.tenantId as string | undefined)?.trim();
  if (!tenantId) {
    return res.status(400).json({ erro: "Parâmetro tenantId é obrigatório" });
  }

  const relatorio = relatorioKpiTenant(tenantId);
  return res.json(relatorio);
});

// ─── Serviço por tenant (SaaS SoA) ───────────────────────────────────────────

const ServiceProfileParamsSchema = z.object({
  tenantId: z.string().uuid(),
  serviceCode: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/),
});

const ServiceProfileBodySchema = z.object({
  serviceName: z.string().min(1).max(120),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]),
  slaAvailabilityPct: z.number().min(90).max(99.999),
  sloLatencyP95Ms: z.number().int().min(10).max(60000),
  supportChannel: z.string().min(1).max(60),
  supportHours: z.string().min(1).max(120),
  escalationPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

router.get("/servicos", async (req: Request, res: Response) => {
  if (!isAdminAuthorized(req)) return forbidden(res);

  try {
    const tenantId =
      typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const profiles = await listServiceProfiles(tenantId);
    return res.json({
      total: profiles.length,
      tenantId: tenantId ?? null,
      profiles,
    });
  } catch (error) {
    logger.error("[AdminRoutes] Falha ao listar perfis de serviço", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ erro: "Erro ao listar perfis de serviço" });
  }
});

router.put(
  "/servicos/:tenantId/:serviceCode",
  async (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) return forbidden(res);

    const params = ServiceProfileParamsSchema.safeParse(req.params);
    if (!params.success) {
      return res
        .status(400)
        .json({ erro: "Parâmetros inválidos", detalhes: params.error.issues });
    }

    const body = ServiceProfileBodySchema.safeParse(req.body);
    if (!body.success) {
      return res
        .status(400)
        .json({ erro: "Corpo inválido", detalhes: body.error.issues });
    }

    try {
      const profile = await upsertServiceProfile({
        tenantId: params.data.tenantId,
        serviceCode: params.data.serviceCode,
        serviceName: body.data.serviceName,
        tier: body.data.tier,
        slaAvailabilityPct: body.data.slaAvailabilityPct,
        sloLatencyP95Ms: body.data.sloLatencyP95Ms,
        supportChannel: body.data.supportChannel,
        supportHours: body.data.supportHours,
        escalationPolicy: body.data.escalationPolicy ?? {},
        metadata: body.data.metadata ?? {},
        isActive: body.data.isActive,
      });

      return res.json({ profile, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[AdminRoutes] Falha ao upsertar perfil de serviço", {
        tenantId: params.data.tenantId,
        serviceCode: params.data.serviceCode,
        error: message,
      });
      return res.status(500).json({ erro: message });
    }
  },
);

router.delete(
  "/servicos/:tenantId/:serviceCode",
  async (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) return forbidden(res);

    const params = ServiceProfileParamsSchema.safeParse(req.params);
    if (!params.success) {
      return res
        .status(400)
        .json({ erro: "Parâmetros inválidos", detalhes: params.error.issues });
    }

    try {
      const removed = await removeServiceProfile(
        params.data.tenantId,
        params.data.serviceCode,
      );
      if (!removed) {
        return res.status(404).json({ erro: "Perfil de serviço não encontrado" });
      }
      return res.json({ removed: true });
    } catch (error) {
      logger.error("[AdminRoutes] Falha ao remover perfil de serviço", {
        tenantId: params.data.tenantId,
        serviceCode: params.data.serviceCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ erro: "Erro ao remover perfil de serviço" });
    }
  },
);

export default router;
