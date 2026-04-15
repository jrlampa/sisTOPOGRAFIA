/**
 * holdingService.test.ts — Testes unitários do serviço de holdings (Item 129 [T1]).
 */
import {
  criarHolding,
  associarTenant,
  listarTenantsDaHolding,
  holdingDoTenant,
  auditoriaCruzada,
  listarHoldings,
  _resetHoldings,
} from "../services/holdingService.js";

beforeEach(() => _resetHoldings());

describe("criarHolding", () => {
  it("cria holding com id, nome, slug, ativa=true e criadoEm", () => {
    const h = criarHolding("Empresa Alpha", "empresa-alpha");
    expect(h.id).toBeDefined();
    expect(h.nome).toBe("Empresa Alpha");
    expect(h.slug).toBe("empresa-alpha");
    expect(h.ativa).toBe(true);
    expect(h.criadoEm).toBeInstanceOf(Date);
  });

  it("cada holding tem id único", () => {
    const h1 = criarHolding("A", "slug-a");
    const h2 = criarHolding("B", "slug-b");
    expect(h1.id).not.toBe(h2.id);
  });

  it("adiciona à lista de holdings", () => {
    criarHolding("X", "slug-x");
    expect(listarHoldings()).toHaveLength(1);
  });
});

describe("listarHoldings", () => {
  it("retorna lista vazia inicialmente", () => {
    expect(listarHoldings()).toEqual([]);
  });

  it("retorna todas as holdings criadas", () => {
    criarHolding("A", "a");
    criarHolding("B", "b");
    criarHolding("C", "c");
    expect(listarHoldings()).toHaveLength(3);
  });
});

describe("associarTenant", () => {
  it("associa tenant a holding com papel correto", () => {
    const h = criarHolding("Corp", "corp");
    const th = associarTenant("tenant-1", h.id, "principal");
    expect(th.tenantId).toBe("tenant-1");
    expect(th.holdingId).toBe(h.id);
    expect(th.papel).toBe("principal");
    expect(th.criadoEm).toBeInstanceOf(Date);
  });

  it("permite múltiplos tenants na mesma holding", () => {
    const h = criarHolding("Corp", "corp");
    associarTenant("t1", h.id, "principal");
    associarTenant("t2", h.id, "subsidiaria");
    associarTenant("t3", h.id, "empreiteira");
    expect(listarTenantsDaHolding(h.id)).toHaveLength(3);
  });
});

describe("listarTenantsDaHolding", () => {
  it("retorna lista vazia para holding sem tenants", () => {
    const h = criarHolding("Vazia", "vazia");
    expect(listarTenantsDaHolding(h.id)).toEqual([]);
  });

  it("filtra tenants por holdingId", () => {
    const h1 = criarHolding("H1", "h1");
    const h2 = criarHolding("H2", "h2");
    associarTenant("ta", h1.id, "principal");
    associarTenant("tb", h2.id, "subsidiaria");
    associarTenant("tc", h1.id, "empreiteira");
    const tenants = listarTenantsDaHolding(h1.id);
    expect(tenants).toHaveLength(2);
    expect(tenants.every(t => t.holdingId === h1.id)).toBe(true);
  });
});

describe("holdingDoTenant", () => {
  it("retorna null para tenant não associado", () => {
    expect(holdingDoTenant("nao-existe")).toBeNull();
  });

  it("retorna holding correta do tenant", () => {
    const h = criarHolding("Holding X", "holding-x");
    associarTenant("tenant-abc", h.id, "principal");
    const resultado = holdingDoTenant("tenant-abc");
    expect(resultado).not.toBeNull();
    expect(resultado?.nome).toBe("Holding X");
    expect(resultado?.id).toBe(h.id);
  });

  it("retorna null quando holdingId não existe no mapa", () => {
    // Associar tenant com holdingId que não existe
    associarTenant("tenant-orphan", "holding-nao-existe", "principal");
    expect(holdingDoTenant("tenant-orphan")).toBeNull();
  });
});

describe("auditoriaCruzada", () => {
  it("retorna estrutura correta para holding vazia", () => {
    const h = criarHolding("Auditada", "auditada");
    const auditoria = auditoriaCruzada(h.id);
    expect(auditoria.holdingId).toBe(h.id);
    expect(auditoria.tenants).toEqual([]);
    expect(auditoria.totalTenants).toBe(0);
    expect(auditoria.auditadoEm).toBeInstanceOf(Date);
  });

  it("lista todos os tenants da holding na auditoria", () => {
    const h = criarHolding("Grupo", "grupo");
    associarTenant("t1", h.id, "principal");
    associarTenant("t2", h.id, "subsidiaria");
    const auditoria = auditoriaCruzada(h.id);
    expect(auditoria.totalTenants).toBe(2);
    expect(auditoria.tenants).toContain("t1");
    expect(auditoria.tenants).toContain("t2");
  });
});

describe("_resetHoldings", () => {
  it("limpa todas as holdings e associações", () => {
    const h = criarHolding("H", "h");
    associarTenant("t", h.id, "principal");
    _resetHoldings();
    expect(listarHoldings()).toEqual([]);
    expect(listarTenantsDaHolding(h.id)).toEqual([]);
  });
});
