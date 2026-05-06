import {
  trackTrustObservability,
  _resetTrustObservabilityState,
} from "../services/trustObservabilityService";
import {
  clearAllKpiEvents,
  listarEventosKpi,
} from "../services/businessKpiService";
import {
  clearCriticalFlowState,
  registrarEventoFluxoCritico,
} from "../services/criticalFlowContractService";

type ReqLike = {
  method: string;
  baseUrl: string;
  route?: { path?: string };
  path: string;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
};

type ResLike = {
  statusCode: number;
  locals: {
    operation_id?: string;
    projeto_id?: string;
    ponto_id?: string;
  };
};

function buildReq(overrides?: Partial<ReqLike>): ReqLike {
  return {
    method: "POST",
    baseUrl: "/api/analyze",
    route: { path: "/" },
    path: "/",
    headers: {},
    query: {},
    ...overrides,
  };
}

function buildRes(overrides?: Partial<ResLike>): ResLike {
  return {
    statusCode: 200,
    locals: {},
    ...overrides,
  };
}

describe("trustObservabilityService", () => {
  beforeEach(() => {
    clearAllKpiEvents();
    clearCriticalFlowState();
    _resetTrustObservabilityState();
  });

  it("registra KPI de análise para rota UX mapeada", () => {
    const req = buildReq({
      baseUrl: "/api/analyze",
      headers: { "x-tenant-id": "tenant-a" },
    });
    const res = buildRes({ statusCode: 200 });

    trackTrustObservability(req as any, res as any, 850);

    const eventos = listarEventosKpi("tenant-a", { tipo: "analise_rede" });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].resultado).toBe("sucesso");
    expect(eventos[0].duracaoMs).toBe(850);
    expect(eventos[0].metadados).toMatchObject({
      uxEvent: "ux_fluxo_analise_solicitada",
      statusCode: 200,
    });
  });

  it("classifica falha em status >= 400", () => {
    const req = buildReq({
      baseUrl: "/api/dxf",
      headers: { "x-tenant-id": "tenant-b" },
    });
    const res = buildRes({ statusCode: 503 });

    trackTrustObservability(req as any, res as any, 1200);

    const eventos = listarEventosKpi("tenant-b", { tipo: "exportacao_dxf" });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].resultado).toBe("falha");
  });

  it("marca retrabalho quando mesma operação reaparece na janela", () => {
    const req = buildReq({
      baseUrl: "/api/dxf",
      headers: { "x-tenant-id": "tenant-c" },
    });
    const res1 = buildRes({
      statusCode: 202,
      locals: { operation_id: "op-123" },
    });
    const res2 = buildRes({
      statusCode: 200,
      locals: { operation_id: "op-123" },
    });

    trackTrustObservability(req as any, res1 as any, 2000);
    trackTrustObservability(req as any, res2 as any, 2100);

    const eventos = listarEventosKpi("tenant-c", { tipo: "exportacao_dxf" });
    expect(eventos).toHaveLength(2);
    expect(eventos[0].resultado).toBe("sucesso");
    expect(eventos[1].resultado).toBe("retrabalho");
  });

  it("sinaliza fluxo crítico snapshot quando há projeto e ponto", () => {
    const req = buildReq({
      baseUrl: "/api/dxf",
      headers: { "x-tenant-id": "tenant-d" },
    });
    const res = buildRes({
      statusCode: 200,
      locals: {
        operation_id: "op-777",
        projeto_id: "PRJ-01",
        ponto_id: "PT-01",
      },
    });

    trackTrustObservability(req as any, res as any, 3450);

    const duplicateSnapshot = registrarEventoFluxoCritico({
      tenantId: "tenant-d",
      projetoId: "PRJ-01",
      pontoId: "PT-01",
      etapa: "snapshot",
      ocorridoEm: new Date(),
    });

    expect(duplicateSnapshot.status).toBe(422);
    expect(duplicateSnapshot.code).toBe("INVALID_TRANSITION");
  });
});
