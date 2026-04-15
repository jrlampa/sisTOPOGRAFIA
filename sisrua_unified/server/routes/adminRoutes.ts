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
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
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

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  const token = config.ADMIN_TOKEN ?? config.METRICS_TOKEN;
  if (!token) {
    return true;
  }
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(token, "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function forbidden(res: Response): Response {
  res.set("WWW-Authenticate", 'Bearer realm="admin"');
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

export default router;
