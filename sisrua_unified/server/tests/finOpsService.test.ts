/**
 * finOpsService.test.ts — Testes unitários do serviço FinOps (Item 130 [T1]).
 */
import {
  registrarCusto,
  definirOrcamento,
  consumoMensalPorAmbiente,
  alertasOrcamento,
  resumoFinOps,
  _resetFinOps,
  AmbienteFinOps,
  CategoriaFinOps,
} from "../services/finOpsService.js";

function makeCusto(overrides: Partial<{ ambiente: AmbienteFinOps; categoria: CategoriaFinOps; valorUsd: number; descricao: string; tenantId: string }> = {}) {
  return {
    ambiente: "producao" as AmbienteFinOps,
    categoria: "api_externa" as CategoriaFinOps,
    valorUsd: 10.5,
    descricao: "Chamada API externa",
    ...overrides,
  };
}

beforeEach(() => _resetFinOps());

describe("registrarCusto", () => {
  it("registra custo e gera id + registradoEm", () => {
    const r = registrarCusto(makeCusto());
    expect(r.id).toBeDefined();
    expect(r.registradoEm).toBeInstanceOf(Date);
    expect(r.ambiente).toBe("producao");
    expect(r.valorUsd).toBe(10.5);
  });

  it("cada registro tem id único", () => {
    const r1 = registrarCusto(makeCusto());
    const r2 = registrarCusto(makeCusto());
    expect(r1.id).not.toBe(r2.id);
  });

  it("preserva tenantId opcional", () => {
    const r = registrarCusto(makeCusto({ tenantId: "empresa-a" }));
    expect(r.tenantId).toBe("empresa-a");
  });

  it("adiciona ao histórico de registros", () => {
    registrarCusto(makeCusto());
    registrarCusto(makeCusto());
    expect(resumoFinOps().totalRegistros).toBe(2);
  });
});

describe("definirOrcamento", () => {
  it("define orçamento sem erro", () => {
    expect(() => definirOrcamento({ ambiente: "dev", limiteMensalUsd: 100, alertaPct: 80 })).not.toThrow();
  });

  it("sobrescreve orçamento existente para mesmo ambiente", () => {
    definirOrcamento({ ambiente: "dev", limiteMensalUsd: 100, alertaPct: 80 });
    definirOrcamento({ ambiente: "dev", limiteMensalUsd: 200, alertaPct: 70 });
    const alertas = alertasOrcamento(new Date().getFullYear(), new Date().getMonth() + 1);
    const devAlerta = alertas.find(a => a.ambiente === "dev");
    expect(devAlerta?.limiteMensalUsd).toBe(200);
  });
});

describe("consumoMensalPorAmbiente", () => {
  it("retorna objeto vazio quando sem registros", () => {
    expect(consumoMensalPorAmbiente(2024, 1)).toEqual({});
  });

  it("soma custos por ambiente no período correto", () => {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    registrarCusto(makeCusto({ ambiente: "producao", valorUsd: 50 }));
    registrarCusto(makeCusto({ ambiente: "producao", valorUsd: 30 }));
    registrarCusto(makeCusto({ ambiente: "dev", valorUsd: 15 }));
    const consumo = consumoMensalPorAmbiente(ano, mes);
    expect(consumo.producao).toBeCloseTo(80);
    expect(consumo.dev).toBeCloseTo(15);
  });

  it("não inclui custos de outros meses", () => {
    registrarCusto(makeCusto({ valorUsd: 999 }));
    const consumo = consumoMensalPorAmbiente(2000, 1);
    expect(Object.keys(consumo)).toHaveLength(0);
  });
});

describe("alertasOrcamento", () => {
  it("retorna lista vazia quando sem orçamentos", () => {
    expect(alertasOrcamento(2024, 6)).toEqual([]);
  });

  it("alerta quando consumo >= alertaPct", () => {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    definirOrcamento({ ambiente: "producao", limiteMensalUsd: 100, alertaPct: 80 });
    registrarCusto(makeCusto({ ambiente: "producao", valorUsd: 85 }));
    const alertas = alertasOrcamento(ano, mes);
    const prodAlerta = alertas.find(a => a.ambiente === "producao");
    expect(prodAlerta?.emAlerta).toBe(true);
    expect(prodAlerta?.pctUsado).toBeCloseTo(85);
  });

  it("não alerta quando consumo < alertaPct", () => {
    const now = new Date();
    definirOrcamento({ ambiente: "dev", limiteMensalUsd: 1000, alertaPct: 80 });
    registrarCusto(makeCusto({ ambiente: "dev", valorUsd: 50 }));
    const alertas = alertasOrcamento(now.getFullYear(), now.getMonth() + 1);
    const devAlerta = alertas.find(a => a.ambiente === "dev");
    expect(devAlerta?.emAlerta).toBe(false);
  });

  it("consumoUsd é 0 quando não há registros no período", () => {
    definirOrcamento({ ambiente: "homolog", limiteMensalUsd: 200, alertaPct: 50 });
    const alertas = alertasOrcamento(2000, 1);
    const homologAlerta = alertas.find(a => a.ambiente === "homolog");
    expect(homologAlerta?.consumoUsd).toBe(0);
    expect(homologAlerta?.emAlerta).toBe(false);
  });
});

describe("resumoFinOps", () => {
  it("retorna totais zerados inicialmente", () => {
    const resumo = resumoFinOps();
    expect(resumo.totalRegistros).toBe(0);
    expect(resumo.totalUsd).toBe(0);
    expect(resumo.porAmbiente).toEqual({});
    expect(resumo.porCategoria).toEqual({});
  });

  it("soma totalUsd corretamente", () => {
    registrarCusto(makeCusto({ valorUsd: 10 }));
    registrarCusto(makeCusto({ valorUsd: 20 }));
    registrarCusto(makeCusto({ valorUsd: 5 }));
    expect(resumoFinOps().totalUsd).toBeCloseTo(35);
  });

  it("distribui por ambiente", () => {
    registrarCusto(makeCusto({ ambiente: "dev", valorUsd: 5 }));
    registrarCusto(makeCusto({ ambiente: "producao", valorUsd: 50 }));
    const resumo = resumoFinOps();
    expect(resumo.porAmbiente.dev).toBeCloseTo(5);
    expect(resumo.porAmbiente.producao).toBeCloseTo(50);
  });

  it("distribui por categoria", () => {
    registrarCusto(makeCusto({ categoria: "api_externa", valorUsd: 100 }));
    registrarCusto(makeCusto({ categoria: "armazenamento", valorUsd: 25 }));
    const resumo = resumoFinOps();
    expect(resumo.porCategoria.api_externa).toBeCloseTo(100);
    expect(resumo.porCategoria.armazenamento).toBeCloseTo(25);
  });

  it("totalRegistros conta todos os registros", () => {
    for (let i = 0; i < 5; i++) registrarCusto(makeCusto());
    expect(resumoFinOps().totalRegistros).toBe(5);
  });
});
