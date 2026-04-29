import { vi } from "vitest";
/**
 * adminRoutes.test.ts
 * Testes de integração das rotas de Autoatendimento Administrativo (Item 35 [T1]).
 */

import express from "express";
import request from "supertest";

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const TOKEN = "admin-secret-token";
const AUTH = "Bearer " + TOKEN;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUsersByRole = vi.fn();
const mockSetUserRole = vi.fn();
const mockGetRoleStatistics = vi.fn();

vi.mock("../services/roleService", () => ({
  getUsersByRole: (...args: unknown[]) => mockGetUsersByRole(...args),
  setUserRole: (...args: unknown[]) => mockSetUserRole(...args),
  getRoleStatistics: (...args: unknown[]) => mockGetRoleStatistics(...args),
}));

const mockGetTenantQuotas = vi.fn().mockReturnValue({});
const mockListarTenantComQuotas = vi.fn().mockReturnValue([]);

vi.mock("../services/tenantQuotaService", () => ({
  getTenantQuotas: (...args: unknown[]) => mockGetTenantQuotas(...args),
  listarTenantComQuotas: () => mockListarTenantComQuotas(),
  JANELA_QUOTA_MS: {
    jobs_por_hora: 3_600_000,
    jobs_por_dia: 86_400_000,
    dxf_por_hora: 3_600_000,
    analise_por_hora: 3_600_000,
    armazenamento_mb: 0,
  },
}));

const mockGetTenantFlagOverrides = vi.fn().mockReturnValue({});

vi.mock("../services/tenantFeatureFlagService", () => ({
  getTenantFlagOverrides: (...args: unknown[]) =>
    mockGetTenantFlagOverrides(...args),
}));

const mockRelatorioKpiTenant = vi.fn();

vi.mock("../services/businessKpiService", () => ({
  relatorioKpiTenant: (...args: unknown[]) => mockRelatorioKpiTenant(...args),
}));

const mockGetSystemHealthMvsReport = vi.fn();

vi.mock("../services/systemHealthDashboardService", () => ({
  getSystemHealthMvsReport: () => mockGetSystemHealthMvsReport(),
}));

const mockGetDbClient = vi.fn().mockReturnValue(null);

vi.mock("../repositories/dbClient", () => ({
  getDbClient: () => mockGetDbClient(),
  isDbAvailable: () => false,
}));

async function buildApp(adminToken: string | undefined, nodeEnv = "test") {
  vi.resetModules();
  vi.doMock("../config", () => ({
    config: {
      ADMIN_TOKEN: adminToken,
      METRICS_TOKEN: undefined,
      NODE_ENV: nodeEnv,
      APP_VERSION: "1.0.0-test",
    },
  }));
  const { default: adminRoutes } = await import("../routes/adminRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsersByRole.mockResolvedValue([]);
  mockSetUserRole.mockResolvedValue(true);
  mockGetRoleStatistics.mockResolvedValue({
    admin: 0,
    technician: 0,
    viewer: 0,
    guest: 0,
  });
  mockRelatorioKpiTenant.mockReturnValue({
    tenantId: "empresa-a",
    global: { total: 0, taxaSucesso: 1 },
  });
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── GET /saude ───────────────────────────────────────────────────────────────

describe("GET /api/admin/saude", () => {
  it("retorna 401 sem autenticação quando ADMIN_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/saude");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="admin"');
  });

  it("retorna 200 com token válido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/saude")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.painel).toBe("Painel de Autoatendimento Administrativo");
    expect(res.body.status).toBe("operacional");
    expect(res.body.banco).toBe("indisponível");
  });
});

// ─── GET /usuarios ────────────────────────────────────────────────────────────

describe("GET /api/admin/usuarios", () => {
  it("retorna 401 sem token quando ADMIN_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/usuarios");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="admin"');
  });

  it("retorna 200 com lista vazia quando não há usuários", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/usuarios")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.usuarios).toEqual([]);
  });

  it("agrega usuários de todos os papéis", async () => {
    mockGetUsersByRole.mockImplementation((papel: string) => {
      if (papel === "admin")
        return [
          { user_id: "u1", role: "admin", assigned_at: "", last_updated: "" },
        ];
      if (papel === "technician")
        return [
          {
            user_id: "u2",
            role: "technician",
            assigned_at: "",
            last_updated: "",
          },
        ];
      return [];
    });
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/usuarios")
      .set("Authorization", AUTH);
    expect(res.body.total).toBe(2);
    expect(
      res.body.usuarios.some((u: { userId: string }) => u.userId === "u1"),
    ).toBe(true);
    expect(
      res.body.usuarios.some((u: { userId: string }) => u.userId === "u2"),
    ).toBe(true);
  });
});

// ─── PUT /usuarios/:userId/papel ──────────────────────────────────────────────

describe("PUT /api/admin/usuarios/:userId/papel", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/user-1/papel")
      .send({ papel: "technician", atribuidoPor: "admin@empresa.com" });
    expect(res.status).toBe(401);
  });

  it("atualiza papel com sucesso e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/user-1/papel")
      .set("Authorization", AUTH)
      .send({
        papel: "technician",
        atribuidoPor: "admin@empresa.com",
        motivo: "Promoção",
      });
    expect(res.status).toBe(200);
    expect(res.body.papel).toBe("technician");
    expect(res.body.atualizado).toBe(true);
  });

  it("retorna 400 para papel inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/user-1/papel")
      .set("Authorization", AUTH)
      .send({ papel: "superadmin", atribuidoPor: "admin" });
    expect(res.status).toBe(400);
  });

  it("bloqueia userId com '..' (path traversal protegido por 400 ou 404)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/../../evil/papel")
      .set("Authorization", AUTH)
      .send({ papel: "viewer", atribuidoPor: "admin" });
    // Express normaliza a URL (404) ou o handler rejeita (400) — ambos são seguros
    expect([400, 404]).toContain(res.status);
  });

  it("retorna 400 para atribuidoPor vazio", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/user-1/papel")
      .set("Authorization", AUTH)
      .send({ papel: "viewer", atribuidoPor: "" });
    expect(res.status).toBe(400);
  });

  it("retorna 500 quando setUserRole falha", async () => {
    mockSetUserRole.mockResolvedValue(false);
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/admin/usuarios/user-err/papel")
      .set("Authorization", AUTH)
      .send({ papel: "viewer", atribuidoPor: "admin" });
    expect(res.status).toBe(500);
  });
});

// ─── GET /papeis/estatisticas ─────────────────────────────────────────────────

describe("GET /api/admin/papeis/estatisticas", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/papeis/estatisticas");
    expect(res.status).toBe(401);
  });

  it("retorna distribuição de papéis", async () => {
    mockGetRoleStatistics.mockResolvedValue({
      admin: 2,
      technician: 5,
      viewer: 10,
      guest: 0,
    });
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/papeis/estatisticas")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.distribuicao.admin).toBe(2);
    expect(res.body.distribuicao.technician).toBe(5);
  });
});

// ─── GET /tenants ─────────────────────────────────────────────────────────────

describe("GET /api/admin/tenants", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/tenants");
    expect(res.status).toBe(401);
  });

  it("retorna aviso quando banco indisponível", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.aviso).toBeDefined();
  });
});

// ─── GET /quotas ──────────────────────────────────────────────────────────────

describe("GET /api/admin/quotas", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/quotas");
    expect(res.status).toBe(401);
  });

  it("retorna lista de tipos e tenants quando sem tenantId", async () => {
    mockListarTenantComQuotas.mockReturnValue(["empresa-a", "empresa-b"]);
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/quotas")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tipos)).toBe(true);
    expect(res.body.tenantsComQuotas).toEqual(["empresa-a", "empresa-b"]);
  });

  it("retorna quotas de tenant específico com tenantId param", async () => {
    mockGetTenantQuotas.mockReturnValue({ jobs_por_hora: { limite: 50 } });
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/quotas?tenantId=empresa-a")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-a");
    expect(res.body.quotas).toBeDefined();
  });
});

// ─── GET /feature-flags ───────────────────────────────────────────────────────

describe("GET /api/admin/feature-flags", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get(
      "/api/admin/feature-flags?tenantId=empresa-a",
    );
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem tenantId", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/feature-flags")
      .set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });

  it("retorna feature flags do tenant", async () => {
    mockGetTenantFlagOverrides.mockReturnValue({
      BT_RADIAL_ENABLED: true,
      DARK_MODE: false,
    });
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/feature-flags?tenantId=empresa-a")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-a");
    expect(res.body.total).toBe(2);
    expect(res.body.flags.BT_RADIAL_ENABLED).toBe(true);
  });
});

// ─── GET /kpis ────────────────────────────────────────────────────────────────

describe("GET /api/admin/kpis", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/admin/kpis?tenantId=empresa-a");
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem tenantId", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/kpis")
      .set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });

  it("retorna relatório KPI do tenant", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/admin/kpis?tenantId=empresa-a")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-a");
    expect(res.body.global).toBeDefined();
  });
});

// ─── modo dev (sem token) ─────────────────────────────────────────────────────

describe("sem token configurado (regra unificada)", () => {
  it("permite acesso a /usuarios sem token quando NODE_ENV=development", async () => {
    const app = await buildApp(undefined, "development");
    const res = await request(app).get("/api/admin/usuarios");
    expect(res.status).toBe(200);
  });
});

// ─── Additional coverage: tenants DB, userId with .., servicos routes ────────

const mockListServiceProfiles = vi.fn().mockResolvedValue([]);
const mockUpsertServiceProfile = vi.fn();
const mockRemoveServiceProfile = vi.fn();

vi.mock("../services/tenantServiceProfileService", () => ({
  listServiceProfiles: (...args: unknown[]) => mockListServiceProfiles(...args),
  upsertServiceProfile: (...args: unknown[]) => mockUpsertServiceProfile(...args),
  removeServiceProfile: (...args: unknown[]) => mockRemoveServiceProfile(...args),
}));

async function buildAppFull(adminToken: string | undefined, dbClient: unknown = null, nodeEnv = "test") {
  vi.resetModules();
  vi.doMock("../config", () => ({
    config: {
      ADMIN_TOKEN: adminToken,
      METRICS_TOKEN: undefined,
      NODE_ENV: nodeEnv,
      APP_VERSION: "1.0.0-test",
    },
  }));
  vi.doMock("../repositories/dbClient", () => ({
    getDbClient: () => dbClient,
    isDbAvailable: () => !!dbClient,
  }));
  const { default: adminRoutes } = await import("../routes/adminRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  return app;
}

const TOKEN2 = "admin-secret-token";
const AUTH2 = "Bearer " + TOKEN2;

describe("adminRoutes — userId com .. (path traversal bloqueado)", () => {
  it("retorna 400 quando userId contem ..", async () => {
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .put("/api/admin/usuarios/..%2Fevil/papel")
      .set("Authorization", AUTH2)
      .send({ papel: "admin", atribuidoPor: "tester" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("userId inválido");
  });
});

describe("adminRoutes — tenants com DB disponivel", () => {
  it("retorna lista de tenants quando SQL funciona", async () => {
    const mockRows = [
      { id: "1", slug: "tenant-a", name: "Tenant A", plan: "basic", is_active: true, created_at: "2024-01-01" },
    ];
    const mockSql = vi.fn().mockResolvedValue(mockRows);
    const app = await buildAppFull(TOKEN2, mockSql);
    const res = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", AUTH2);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tenants).toHaveLength(1);
  });

  it("retorna 500 quando SQL lanca erro", async () => {
    const mockSqlErr = vi.fn().mockRejectedValue(new Error("db crash"));
    const app = await buildAppFull(TOKEN2, mockSqlErr);
    const res = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", AUTH2);
    expect(res.status).toBe(500);
    expect(res.body.erro).toContain("Erro interno");
  });
});

describe("adminRoutes — rotas /servicos", () => {
  const validTenantId = "550e8400-e29b-41d4-a716-446655440000";
  const validServiceCode = "mapa-topografico";

  it("GET /servicos retorna lista de perfis", async () => {
    const mockProfiles = [{ tenantId: validTenantId, serviceCode: validServiceCode }];
    mockListServiceProfiles.mockResolvedValueOnce(mockProfiles);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .get("/api/admin/servicos")
      .set("Authorization", AUTH2);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("PUT /servicos/:tenantId/:serviceCode retorna perfil criado", async () => {
    const mockProfile = { tenantId: validTenantId, serviceCode: validServiceCode, tier: "silver" };
    mockUpsertServiceProfile.mockResolvedValueOnce(mockProfile);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .put(`/api/admin/servicos/${validTenantId}/${validServiceCode}`)
      .set("Authorization", AUTH2)
      .send({
        serviceName: "Mapa Topografico",
        tier: "silver",
        slaAvailabilityPct: 99.5,
        sloLatencyP95Ms: 500,
        supportChannel: "email",
        supportHours: "24x7",
      });
    expect(res.status).toBe(200);
    expect(res.body.upserted).toBe(true);
  });

  it("PUT /servicos — retorna 400 para tenantId invalido (nao UUID)", async () => {
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .put(`/api/admin/servicos/not-a-uuid/${validServiceCode}`)
      .set("Authorization", AUTH2)
      .send({ serviceName: "x", tier: "silver", slaAvailabilityPct: 99, sloLatencyP95Ms: 500, supportChannel: "x", supportHours: "24x7" });
    expect(res.status).toBe(400);
  });

  it("DELETE /servicos/:tenantId/:serviceCode retorna removed:true", async () => {
    mockRemoveServiceProfile.mockResolvedValueOnce(true);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .delete(`/api/admin/servicos/${validTenantId}/${validServiceCode}`)
      .set("Authorization", AUTH2);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
  });

  it("DELETE /servicos — retorna 404 quando perfil nao encontrado", async () => {
    mockRemoveServiceProfile.mockResolvedValueOnce(false);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .delete(`/api/admin/servicos/${validTenantId}/${validServiceCode}`)
      .set("Authorization", AUTH2);
    expect(res.status).toBe(404);
  });
});

describe("adminRoutes — GET /dashboard-mvs", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildAppFull(TOKEN2);
    const res = await request(app).get("/api/admin/dashboard-mvs");
    expect(res.status).toBe(401);
  });

  it("retorna 200 com dados mockados quando serviço responde", async () => {
    const mockReport = {
      btHistory: [],
      auditStats: [],
      catalogSummary: [],
      timestamp: new Date().toISOString(),
    };
    mockGetSystemHealthMvsReport.mockResolvedValueOnce(mockReport);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .get("/api/admin/dashboard-mvs")
      .set("Authorization", AUTH2);
    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeDefined();
  });

  it("retorna 503 quando serviço retorna null (banco offline)", async () => {
    mockGetSystemHealthMvsReport.mockResolvedValueOnce(null);
    const app = await buildAppFull(TOKEN2);
    const res = await request(app)
      .get("/api/admin/dashboard-mvs")
      .set("Authorization", AUTH2);
    expect(res.status).toBe(503);
    expect(res.body.erro).toContain("indisponível");
  });
});

