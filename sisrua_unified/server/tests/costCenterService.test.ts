/**
 * costCenterService.test.ts
 * Testes unitários do serviço de centros de custo (Roadmap Item 36 [T2]).
 */

import {
  criarCentroCusto,
  atualizarCentroCusto,
  getCentroCusto,
  listarCentrosCusto,
  desativarCentroCusto,
  registrarCusto,
  listarRegistros,
  relatorioTenantCusto,
  clearAllCostCenters,
} from "../services/costCenterService.js";

beforeEach(() => {
  clearAllCostCenters();
});

// ─── criarCentroCusto ─────────────────────────────────────────────────────────

describe("criarCentroCusto", () => {
  it("cria um CC com campos obrigatórios", () => {
    const cc = criarCentroCusto("empresa-a", "ti", "Tecnologia da Informação");
    expect(cc.id).toBe("ti");
    expect(cc.tenantId).toBe("empresa-a");
    expect(cc.nome).toBe("Tecnologia da Informação");
    expect(cc.ativo).toBe(true);
    expect(cc.criadoEm).toBeInstanceOf(Date);
  });

  it("cria CC com descrição opcional", () => {
    const cc = criarCentroCusto("empresa-a", "rh", "Recursos Humanos", "Área de gestão de pessoas");
    expect(cc.descricao).toBe("Área de gestão de pessoas");
  });

  it("normaliza tenantId para lowercase", () => {
    const cc = criarCentroCusto("  EMPRESA-B  ", "cc1", "CC Um");
    expect(cc.tenantId).toBe("empresa-b");
  });

  it("lança erro se ccId já existir para o mesmo tenant", () => {
    criarCentroCusto("empresa-a", "ti", "TI");
    expect(() => criarCentroCusto("empresa-a", "ti", "Outra TI")).toThrow();
  });

  it("permite mesmo ccId para tenants diferentes", () => {
    const c1 = criarCentroCusto("empresa-a", "ti", "TI A");
    const c2 = criarCentroCusto("empresa-b", "ti", "TI B");
    expect(c1.tenantId).toBe("empresa-a");
    expect(c2.tenantId).toBe("empresa-b");
  });

  it("lança erro para nome vazio", () => {
    expect(() => criarCentroCusto("empresa-a", "cc1", "")).toThrow();
    expect(() => criarCentroCusto("empresa-a", "cc1", "   ")).toThrow();
  });

  it("lança erro para tenantId vazio", () => {
    expect(() => criarCentroCusto("", "cc1", "Nome")).toThrow();
  });

  it("lança erro para ccId com caracteres inválidos", () => {
    expect(() => criarCentroCusto("empresa-a", "CC INVÁLIDO", "Nome")).toThrow();
  });
});

// ─── atualizarCentroCusto ─────────────────────────────────────────────────────

describe("atualizarCentroCusto", () => {
  it("atualiza nome e descrição", () => {
    criarCentroCusto("empresa-a", "ops", "Operações");
    const cc = atualizarCentroCusto("empresa-a", "ops", {
      nome: "Operações Atualizado",
      descricao: "Nova descrição",
    });
    expect(cc?.nome).toBe("Operações Atualizado");
    expect(cc?.descricao).toBe("Nova descrição");
  });

  it("atualiza campo ativo", () => {
    criarCentroCusto("empresa-a", "ops", "Operações");
    const cc = atualizarCentroCusto("empresa-a", "ops", { ativo: false });
    expect(cc?.ativo).toBe(false);
  });

  it("retorna null para CC inexistente", () => {
    const resultado = atualizarCentroCusto("empresa-a", "nao-existe", { nome: "X" });
    expect(resultado).toBeNull();
  });

  it("lança erro ao tentar atualizar nome para vazio", () => {
    criarCentroCusto("empresa-a", "ops", "Operações");
    expect(() =>
      atualizarCentroCusto("empresa-a", "ops", { nome: "" }),
    ).toThrow();
  });

  it("atualiza atualizadoEm", () => {
    criarCentroCusto("empresa-a", "ops", "Operações");
    const antes = Date.now();
    const cc = atualizarCentroCusto("empresa-a", "ops", { nome: "Novo" });
    expect(cc!.atualizadoEm.getTime()).toBeGreaterThanOrEqual(antes);
  });
});

// ─── getCentroCusto ───────────────────────────────────────────────────────────

describe("getCentroCusto", () => {
  it("retorna CC existente", () => {
    criarCentroCusto("empresa-c", "fin", "Financeiro");
    const cc = getCentroCusto("empresa-c", "fin");
    expect(cc?.id).toBe("fin");
  });

  it("retorna null para CC inexistente", () => {
    expect(getCentroCusto("empresa-c", "nao-existe")).toBeNull();
  });

  it("retorna cópia independente (sem referência compartilhada)", () => {
    criarCentroCusto("empresa-c", "fin", "Financeiro");
    const cc = getCentroCusto("empresa-c", "fin");
    expect(cc).not.toBeNull();
    // Modificação na cópia não afeta a store
    cc!.nome = "Modificado Externamente";
    expect(getCentroCusto("empresa-c", "fin")?.nome).toBe("Financeiro");
  });
});

// ─── listarCentrosCusto ───────────────────────────────────────────────────────

describe("listarCentrosCusto", () => {
  it("retorna lista vazia para tenant sem CCs", () => {
    expect(listarCentrosCusto("sem-cc")).toEqual([]);
  });

  it("retorna todos os CCs do tenant em ordem alfabética por id", () => {
    criarCentroCusto("empresa-d", "ti", "TI");
    criarCentroCusto("empresa-d", "ops", "Operações");
    criarCentroCusto("empresa-d", "fin", "Financeiro");
    const lista = listarCentrosCusto("empresa-d");
    expect(lista.map((c) => c.id)).toEqual(["fin", "ops", "ti"]);
  });

  it("filtra apenas ativos quando apenasAtivos=true", () => {
    criarCentroCusto("empresa-d", "ti", "TI");
    criarCentroCusto("empresa-d", "ops", "Operações");
    desativarCentroCusto("empresa-d", "ops");
    const lista = listarCentrosCusto("empresa-d", true);
    expect(lista.map((c) => c.id)).toEqual(["ti"]);
  });

  it("não inclui CCs de outros tenants", () => {
    criarCentroCusto("empresa-d", "ti", "TI D");
    criarCentroCusto("empresa-e", "ti", "TI E");
    const lista = listarCentrosCusto("empresa-d");
    expect(lista).toHaveLength(1);
    expect(lista[0].tenantId).toBe("empresa-d");
  });
});

// ─── desativarCentroCusto ─────────────────────────────────────────────────────

describe("desativarCentroCusto", () => {
  it("retorna true e desativa CC existente", () => {
    criarCentroCusto("empresa-f", "cc1", "CC 1");
    expect(desativarCentroCusto("empresa-f", "cc1")).toBe(true);
    expect(getCentroCusto("empresa-f", "cc1")?.ativo).toBe(false);
  });

  it("retorna false para CC inexistente", () => {
    expect(desativarCentroCusto("empresa-f", "nao-existe")).toBe(false);
  });
});

// ─── registrarCusto ───────────────────────────────────────────────────────────

describe("registrarCusto", () => {
  it("registra custo válido e retorna o registro", () => {
    criarCentroCusto("empresa-g", "ti", "TI");
    const r = registrarCusto("empresa-g", "ti", "processamento", 5, "Job DXF gerado");
    expect(r.id).toBeDefined();
    expect(r.tipo).toBe("processamento");
    expect(r.valor).toBe(5);
    expect(r.descricao).toBe("Job DXF gerado");
    expect(r.criadoEm).toBeInstanceOf(Date);
  });

  it("registra custo com metadados opcionais", () => {
    criarCentroCusto("empresa-g", "ti", "TI");
    const r = registrarCusto("empresa-g", "ti", "api_externa", 1, "OSM call", {
      endpoint: "/api/osm",
    });
    expect(r.metadados).toEqual({ endpoint: "/api/osm" });
  });

  it("lança erro para CC inexistente", () => {
    expect(() =>
      registrarCusto("empresa-g", "nao-existe", "processamento", 1, "teste"),
    ).toThrow(/não encontrado/i);
  });

  it("lança erro para CC inativo", () => {
    criarCentroCusto("empresa-g", "inativo", "Inativo");
    desativarCentroCusto("empresa-g", "inativo");
    expect(() =>
      registrarCusto("empresa-g", "inativo", "processamento", 1, "teste"),
    ).toThrow(/inativo/i);
  });

  it("lança RangeError para valor negativo", () => {
    criarCentroCusto("empresa-g", "ti2", "TI2");
    expect(() =>
      registrarCusto("empresa-g", "ti2", "processamento", -1, "teste"),
    ).toThrow(RangeError);
  });

  it("lança RangeError para valor infinito", () => {
    criarCentroCusto("empresa-g", "ti3", "TI3");
    expect(() =>
      registrarCusto("empresa-g", "ti3", "processamento", Infinity, "teste"),
    ).toThrow(RangeError);
  });

  it("aceita valor zero", () => {
    criarCentroCusto("empresa-g", "ti4", "TI4");
    const r = registrarCusto("empresa-g", "ti4", "processamento", 0, "zero custo");
    expect(r.valor).toBe(0);
  });

  it("lança erro para descrição vazia", () => {
    criarCentroCusto("empresa-g", "ti5", "TI5");
    expect(() =>
      registrarCusto("empresa-g", "ti5", "processamento", 1, ""),
    ).toThrow();
  });

  it("gera IDs únicos para registros consecutivos", () => {
    criarCentroCusto("empresa-g", "ti6", "TI6");
    const r1 = registrarCusto("empresa-g", "ti6", "processamento", 1, "r1");
    const r2 = registrarCusto("empresa-g", "ti6", "processamento", 1, "r2");
    expect(r1.id).not.toBe(r2.id);
  });
});

// ─── listarRegistros ──────────────────────────────────────────────────────────

describe("listarRegistros", () => {
  it("retorna lista vazia para CC sem registros", () => {
    criarCentroCusto("empresa-h", "cc1", "CC1");
    expect(listarRegistros("empresa-h", "cc1")).toEqual([]);
  });

  it("retorna registros em ordem cronológica", () => {
    criarCentroCusto("empresa-h", "cc1", "CC1");
    registrarCusto("empresa-h", "cc1", "processamento", 1, "r1");
    registrarCusto("empresa-h", "cc1", "armazenamento", 2, "r2");
    const lista = listarRegistros("empresa-h", "cc1");
    expect(lista).toHaveLength(2);
    expect(lista[0].criadoEm.getTime()).toBeLessThanOrEqual(
      lista[1].criadoEm.getTime(),
    );
  });

  it("filtra por tipo", () => {
    criarCentroCusto("empresa-h", "cc1", "CC1");
    registrarCusto("empresa-h", "cc1", "processamento", 1, "proc");
    registrarCusto("empresa-h", "cc1", "armazenamento", 2, "arq");
    registrarCusto("empresa-h", "cc1", "processamento", 3, "proc2");
    const lista = listarRegistros("empresa-h", "cc1", { tipo: "processamento" });
    expect(lista).toHaveLength(2);
    expect(lista.every((r) => r.tipo === "processamento")).toBe(true);
  });

  it("filtra por período (de / ate)", () => {
    criarCentroCusto("empresa-h", "cc2", "CC2");
    const antes = new Date(Date.now() - 10_000);
    registrarCusto("empresa-h", "cc2", "api_externa", 1, "antigo");
    const depois = new Date(Date.now() + 10_000);
    const lista = listarRegistros("empresa-h", "cc2", { ate: antes });
    expect(lista).toHaveLength(0);
    const lista2 = listarRegistros("empresa-h", "cc2", { de: antes, ate: depois });
    expect(lista2).toHaveLength(1);
  });
});

// ─── relatorioTenantCusto ─────────────────────────────────────────────────────

describe("relatorioTenantCusto", () => {
  it("retorna relatório vazio para tenant sem CCs", () => {
    const r = relatorioTenantCusto("sem-cc");
    expect(r.tenantId).toBe("sem-cc");
    expect(r.centros).toEqual([]);
    expect(r.totalGeral).toBe(0);
  });

  it("agrega custos por tipo corretamente", () => {
    criarCentroCusto("empresa-i", "ti", "TI");
    registrarCusto("empresa-i", "ti", "processamento", 10, "j1");
    registrarCusto("empresa-i", "ti", "processamento", 5, "j2");
    registrarCusto("empresa-i", "ti", "armazenamento", 3, "a1");
    const r = relatorioTenantCusto("empresa-i");
    const cc = r.centros[0];
    expect(cc.totalPorTipo["processamento"]).toBe(15);
    expect(cc.totalPorTipo["armazenamento"]).toBe(3);
    expect(cc.totalGeral).toBe(18);
    expect(r.totalGeral).toBe(18);
  });

  it("soma totais de múltiplos CCs no totalGeral", () => {
    criarCentroCusto("empresa-i", "ti", "TI");
    criarCentroCusto("empresa-i", "ops", "Operações");
    registrarCusto("empresa-i", "ti", "processamento", 10, "j1");
    registrarCusto("empresa-i", "ops", "api_externa", 7, "a1");
    const r = relatorioTenantCusto("empresa-i");
    expect(r.totalGeral).toBe(17);
    expect(r.centros).toHaveLength(2);
  });

  it("inclui CCs sem registros com totalGeral=0", () => {
    criarCentroCusto("empresa-i", "vazio", "Vazio");
    const r = relatorioTenantCusto("empresa-i");
    const cc = r.centros.find((c) => c.centroCustoId === "vazio");
    expect(cc?.totalGeral).toBe(0);
    expect(cc?.registros).toBe(0);
  });
});
