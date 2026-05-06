/**
 * businessKpiService.test.ts
 * Testes unitários do serviço de observabilidade de negócio (Item 125 [T1]).
 */

import {
  registrarEventoKpi,
  listarEventosKpi,
  relatorioKpiTenant,
  clearAllKpiEvents,
} from "../services/businessKpiService.js";

beforeEach(() => {
  clearAllKpiEvents();
});

// ─── registrarEventoKpi ───────────────────────────────────────────────────────

describe("registrarEventoKpi", () => {
  it("registra evento com campos obrigatórios", () => {
    const e = registrarEventoKpi("empresa-a", "exportacao_dxf", "sucesso", 1500);
    expect(e.id).toBeDefined();
    expect(e.tenantId).toBe("empresa-a");
    expect(e.tipo).toBe("exportacao_dxf");
    expect(e.resultado).toBe("sucesso");
    expect(e.duracaoMs).toBe(1500);
    expect(e.ocorridoEm).toBeInstanceOf(Date);
  });

  it("normaliza tenantId para lowercase", () => {
    const e = registrarEventoKpi("  EMPRESA-B  ", "analise_rede", "falha", 200);
    expect(e.tenantId).toBe("empresa-b");
  });

  it("registra com projetoId e regiao opcionais", () => {
    const e = registrarEventoKpi("empresa-c", "calculo_bt", "sucesso", 800, {
      projetoId: "PROJ-001",
      regiao: "Sul",
      metadados: { linhas: 42 },
    });
    expect(e.projetoId).toBe("PROJ-001");
    expect(e.regiao).toBe("sul");
    expect(e.metadados).toEqual({ linhas: 42 });
  });

  it("aceita duracaoMs = 0", () => {
    const e = registrarEventoKpi("empresa-d", "relatorio", "sucesso", 0);
    expect(e.duracaoMs).toBe(0);
  });

  it("lança RangeError para duracaoMs negativa", () => {
    expect(() =>
      registrarEventoKpi("empresa-d", "exportacao_dxf", "sucesso", -1),
    ).toThrow(RangeError);
  });

  it("lança RangeError para duracaoMs infinita", () => {
    expect(() =>
      registrarEventoKpi("empresa-d", "exportacao_dxf", "sucesso", Infinity),
    ).toThrow(RangeError);
  });

  it("lança erro para tenantId vazio", () => {
    expect(() =>
      registrarEventoKpi("", "exportacao_dxf", "sucesso", 100),
    ).toThrow();
  });

  it("gera IDs únicos para eventos consecutivos", () => {
    const e1 = registrarEventoKpi("empresa-e", "exportacao_dxf", "sucesso", 100);
    const e2 = registrarEventoKpi("empresa-e", "exportacao_dxf", "sucesso", 200);
    expect(e1.id).not.toBe(e2.id);
  });

  it("isolamento por tenant: eventos não vazam entre tenants", () => {
    registrarEventoKpi("empresa-x", "exportacao_dxf", "sucesso", 100);
    const lista = listarEventosKpi("empresa-y");
    expect(lista).toHaveLength(0);
  });
});

// ─── listarEventosKpi ─────────────────────────────────────────────────────────

describe("listarEventosKpi", () => {
  it("retorna lista vazia para tenant sem eventos", () => {
    expect(listarEventosKpi("vazio")).toEqual([]);
  });

  it("retorna eventos em ordem cronológica", () => {
    registrarEventoKpi("empresa-f", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-f", "analise_rede", "falha", 200);
    const lista = listarEventosKpi("empresa-f");
    expect(lista).toHaveLength(2);
    expect(lista[0].ocorridoEm.getTime()).toBeLessThanOrEqual(
      lista[1].ocorridoEm.getTime(),
    );
  });

  it("filtra por tipo", () => {
    registrarEventoKpi("empresa-g", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-g", "analise_rede", "sucesso", 200);
    registrarEventoKpi("empresa-g", "exportacao_dxf", "retrabalho", 300);
    const lista = listarEventosKpi("empresa-g", { tipo: "exportacao_dxf" });
    expect(lista).toHaveLength(2);
    expect(lista.every((e) => e.tipo === "exportacao_dxf")).toBe(true);
  });

  it("filtra por resultado", () => {
    registrarEventoKpi("empresa-h", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-h", "exportacao_dxf", "falha", 200);
    registrarEventoKpi("empresa-h", "exportacao_dxf", "retrabalho", 300);
    const lista = listarEventosKpi("empresa-h", { resultado: "falha" });
    expect(lista).toHaveLength(1);
    expect(lista[0].resultado).toBe("falha");
  });

  it("filtra por região (case-insensitive)", () => {
    registrarEventoKpi("empresa-i", "exportacao_dxf", "sucesso", 100, { regiao: "Sul" });
    registrarEventoKpi("empresa-i", "exportacao_dxf", "sucesso", 200, { regiao: "Norte" });
    const lista = listarEventosKpi("empresa-i", { regiao: "SUL" });
    expect(lista).toHaveLength(1);
    expect(lista[0].regiao).toBe("sul");
  });

  it("filtra por projetoId", () => {
    registrarEventoKpi("empresa-j", "exportacao_dxf", "sucesso", 100, { projetoId: "P1" });
    registrarEventoKpi("empresa-j", "exportacao_dxf", "sucesso", 200, { projetoId: "P2" });
    const lista = listarEventosKpi("empresa-j", { projetoId: "P1" });
    expect(lista).toHaveLength(1);
    expect(lista[0].projetoId).toBe("P1");
  });

  it("filtra por período (de / ate)", () => {
    const agora = new Date();
    const futuro = new Date(agora.getTime() + 60_000);
    registrarEventoKpi("empresa-k", "exportacao_dxf", "sucesso", 100);
    const listaAntes = listarEventosKpi("empresa-k", { ate: new Date(agora.getTime() - 1) });
    expect(listaAntes).toHaveLength(0);
    const listaDentro = listarEventosKpi("empresa-k", { de: agora, ate: futuro });
    expect(listaDentro).toHaveLength(1);
  });
});

// ─── relatorioKpiTenant ───────────────────────────────────────────────────────

describe("relatorioKpiTenant", () => {
  it("retorna relatório vazio para tenant sem eventos", () => {
    const r = relatorioKpiTenant("sem-eventos");
    expect(r.global.total).toBe(0);
    expect(r.global.taxaSucesso).toBe(1);
    expect(r.gargalosRegionais).toHaveLength(0);
  });

  it("calcula taxaSucesso corretamente", () => {
    registrarEventoKpi("empresa-l", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-l", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-l", "exportacao_dxf", "falha", 200);
    const r = relatorioKpiTenant("empresa-l");
    expect(r.global.total).toBe(3);
    expect(r.global.sucessos).toBe(2);
    expect(r.global.falhas).toBe(1);
    expect(r.global.taxaSucesso).toBeCloseTo(2 / 3, 5);
  });

  it("calcula indiceRetrabalho corretamente", () => {
    registrarEventoKpi("empresa-m", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-m", "exportacao_dxf", "retrabalho", 200);
    registrarEventoKpi("empresa-m", "exportacao_dxf", "retrabalho", 300);
    const r = relatorioKpiTenant("empresa-m");
    expect(r.global.retrabalhos).toBe(2);
    expect(r.global.indiceRetrabalho).toBeCloseTo(2 / 3, 5);
  });

  it("calcula duracaoMediaMs e duracaoMaxMs corretamente", () => {
    registrarEventoKpi("empresa-n", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-n", "exportacao_dxf", "sucesso", 300);
    registrarEventoKpi("empresa-n", "exportacao_dxf", "sucesso", 500);
    const r = relatorioKpiTenant("empresa-n");
    expect(r.global.duracaoMediaMs).toBe(300);
    expect(r.global.duracaoMaxMs).toBe(500);
  });

  it("agrega por projeto corretamente", () => {
    registrarEventoKpi("empresa-o", "exportacao_dxf", "sucesso", 100, { projetoId: "P-A" });
    registrarEventoKpi("empresa-o", "exportacao_dxf", "falha", 200, { projetoId: "P-A" });
    registrarEventoKpi("empresa-o", "exportacao_dxf", "sucesso", 150, { projetoId: "P-B" });
    const r = relatorioKpiTenant("empresa-o");
    expect(r.porProjeto["P-A"].total).toBe(2);
    expect(r.porProjeto["P-B"].total).toBe(1);
    expect(r.porProjeto["P-B"].taxaSucesso).toBe(1);
  });

  it("agrega por tipo corretamente", () => {
    registrarEventoKpi("empresa-p", "exportacao_dxf", "sucesso", 100);
    registrarEventoKpi("empresa-p", "exportacao_dxf", "sucesso", 200);
    registrarEventoKpi("empresa-p", "calculo_bt", "falha", 300);
    const r = relatorioKpiTenant("empresa-p");
    expect(r.porTipo["exportacao_dxf"]?.total).toBe(2);
    expect(r.porTipo["calculo_bt"]?.total).toBe(1);
    expect(r.porTipo["calculo_bt"]?.taxaSucesso).toBe(0);
  });

  it("identifica gargalo por alta taxa de falha", () => {
    // 3 falhas em 4 jobs = 75% falha (>10%)
    registrarEventoKpi("empresa-q", "analise_rede", "sucesso", 100, { regiao: "Norte" });
    registrarEventoKpi("empresa-q", "analise_rede", "falha", 200, { regiao: "Norte" });
    registrarEventoKpi("empresa-q", "analise_rede", "falha", 300, { regiao: "Norte" });
    registrarEventoKpi("empresa-q", "analise_rede", "falha", 400, { regiao: "Norte" });
    const r = relatorioKpiTenant("empresa-q");
    const gNorte = r.gargalosRegionais.find((g) => g.regiao === "norte");
    expect(gNorte?.ehGargalo).toBe(true);
    expect(gNorte?.taxaFalha).toBeCloseTo(0.75, 2);
  });

  it("identifica gargalo por duração alta", () => {
    // Duração de 10 min (>5 min limiar)
    registrarEventoKpi("empresa-r", "exportacao_dxf", "sucesso", 10 * 60 * 1000, {
      regiao: "Nordeste",
    });
    const r = relatorioKpiTenant("empresa-r");
    const gNordeste = r.gargalosRegionais.find((g) => g.regiao === "nordeste");
    expect(gNordeste?.ehGargalo).toBe(true);
  });

  it("não classifica como gargalo região com baixa falha e duração normal", () => {
    registrarEventoKpi("empresa-s", "exportacao_dxf", "sucesso", 1000, { regiao: "Sul" });
    registrarEventoKpi("empresa-s", "exportacao_dxf", "sucesso", 2000, { regiao: "Sul" });
    const r = relatorioKpiTenant("empresa-s");
    const gSul = r.gargalosRegionais.find((g) => g.regiao === "sul");
    expect(gSul?.ehGargalo).toBe(false);
  });

  it("ordena gargalosRegionais por taxaFalha decrescente", () => {
    // Região "alta" = 50% falha; região "baixa" = 10% falha
    registrarEventoKpi("empresa-t", "exportacao_dxf", "falha", 100, { regiao: "Alta" });
    registrarEventoKpi("empresa-t", "exportacao_dxf", "sucesso", 100, { regiao: "Alta" });
    registrarEventoKpi("empresa-t", "exportacao_dxf", "falha", 100, { regiao: "Baixa" });
    for (let i = 0; i < 9; i++) {
      registrarEventoKpi("empresa-t", "exportacao_dxf", "sucesso", 100, { regiao: "Baixa" });
    }
    const r = relatorioKpiTenant("empresa-t");
    expect(r.gargalosRegionais[0].regiao).toBe("alta");
    expect(r.gargalosRegionais[1].regiao).toBe("baixa");
  });

  it("respeita filtro de período no relatório", () => {
    const agora = new Date();
    const futuro = new Date(agora.getTime() + 60_000);
    registrarEventoKpi("empresa-u", "exportacao_dxf", "sucesso", 100);
    // Período no futuro (exclui o evento)
    const r = relatorioKpiTenant("empresa-u", futuro, new Date(futuro.getTime() + 1000));
    expect(r.global.total).toBe(0);
  });
});
