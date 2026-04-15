/**
 * tenantQuotaService.test.ts
 * Testes unitários do serviço de quotas e throttling por tenant (Roadmap Item 33 [T2]).
 */

import {
  setTenantQuota,
  getTenantQuotas,
  removeTenantQuota,
  clearTenantQuotas,
  listarTenantComQuotas,
  checkAndConsumeQuota,
  getTenantUsageReport,
  resetTenantUsage,
  clearAllTenantQuotas,
  JANELA_QUOTA_MS,
} from "../services/tenantQuotaService.js";

beforeEach(() => {
  clearAllTenantQuotas();
});

// ─── setTenantQuota ───────────────────────────────────────────────────────────

describe("setTenantQuota", () => {
  it("define limite para um tipo de quota de um tenant", () => {
    setTenantQuota("empresa-a", "jobs_por_hora", 50);
    const quotas = getTenantQuotas("empresa-a");
    expect(quotas["jobs_por_hora"]).toEqual({ limite: 50, cumulativa: false });
  });

  it("sobrescreve limite existente", () => {
    setTenantQuota("empresa-a", "jobs_por_hora", 50);
    setTenantQuota("empresa-a", "jobs_por_hora", 100);
    const quotas = getTenantQuotas("empresa-a");
    expect(quotas["jobs_por_hora"]?.limite).toBe(100);
  });

  it("aceita limite zero (bloqueio total)", () => {
    setTenantQuota("empresa-a", "dxf_por_hora", 0);
    const quotas = getTenantQuotas("empresa-a");
    expect(quotas["dxf_por_hora"]?.limite).toBe(0);
  });

  it("marca quota de armazenamento como cumulativa", () => {
    setTenantQuota("empresa-a", "armazenamento_mb", 1000);
    const quotas = getTenantQuotas("empresa-a");
    expect(quotas["armazenamento_mb"]?.cumulativa).toBe(true);
  });

  it("normaliza tenantId para lowercase com trim", () => {
    setTenantQuota("  EMPRESA-B  ", "jobs_por_dia", 200);
    const quotas = getTenantQuotas("empresa-b");
    expect(quotas["jobs_por_dia"]?.limite).toBe(200);
  });

  it("lança RangeError para limite negativo", () => {
    expect(() => setTenantQuota("empresa-a", "jobs_por_hora", -1)).toThrow(
      RangeError,
    );
  });

  it("lança RangeError para limite infinito", () => {
    expect(() =>
      setTenantQuota("empresa-a", "jobs_por_hora", Infinity),
    ).toThrow(RangeError);
  });

  it("lança RangeError para NaN", () => {
    expect(() => setTenantQuota("empresa-a", "jobs_por_hora", NaN)).toThrow(
      RangeError,
    );
  });

  it("lança erro para tenantId vazio", () => {
    expect(() => setTenantQuota("", "jobs_por_hora", 10)).toThrow();
  });

  it("lança erro para tenantId de espaços", () => {
    expect(() => setTenantQuota("   ", "jobs_por_hora", 10)).toThrow();
  });
});

// ─── getTenantQuotas ──────────────────────────────────────────────────────────

describe("getTenantQuotas", () => {
  it("retorna objeto vazio para tenant sem quotas", () => {
    expect(getTenantQuotas("inexistente")).toEqual({});
  });

  it("retorna todas as quotas configuradas", () => {
    setTenantQuota("empresa-c", "jobs_por_hora", 10);
    setTenantQuota("empresa-c", "dxf_por_hora", 5);
    const quotas = getTenantQuotas("empresa-c");
    expect(quotas["jobs_por_hora"]?.limite).toBe(10);
    expect(quotas["dxf_por_hora"]?.limite).toBe(5);
  });

  it("retorna cópia congelada", () => {
    setTenantQuota("empresa-c", "jobs_por_hora", 10);
    const quotas = getTenantQuotas("empresa-c") as Record<string, unknown>;
    expect(() => {
      quotas["jobs_por_hora"] = { limite: 999, cumulativa: false };
    }).toThrow(TypeError);
  });
});

// ─── removeTenantQuota ────────────────────────────────────────────────────────

describe("removeTenantQuota", () => {
  it("remove quota específica e mantém as demais", () => {
    setTenantQuota("empresa-d", "jobs_por_hora", 10);
    setTenantQuota("empresa-d", "dxf_por_hora", 5);
    removeTenantQuota("empresa-d", "jobs_por_hora");
    const quotas = getTenantQuotas("empresa-d");
    expect(quotas["jobs_por_hora"]).toBeUndefined();
    expect(quotas["dxf_por_hora"]?.limite).toBe(5);
  });

  it("remove entrada do tenant se ficar sem quotas", () => {
    setTenantQuota("empresa-d", "jobs_por_hora", 10);
    removeTenantQuota("empresa-d", "jobs_por_hora");
    expect(listarTenantComQuotas()).not.toContain("empresa-d");
  });

  it("não lança erro ao remover quota inexistente", () => {
    setTenantQuota("empresa-d", "jobs_por_hora", 10);
    expect(() => removeTenantQuota("empresa-d", "dxf_por_hora")).not.toThrow();
  });

  it("não lança erro para tenant inexistente", () => {
    expect(() =>
      removeTenantQuota("tenant_nao_existe", "jobs_por_hora"),
    ).not.toThrow();
  });
});

// ─── clearTenantQuotas ────────────────────────────────────────────────────────

describe("clearTenantQuotas", () => {
  it("retorna true e remove todas as quotas do tenant", () => {
    setTenantQuota("empresa-e", "jobs_por_hora", 10);
    setTenantQuota("empresa-e", "dxf_por_hora", 5);
    const result = clearTenantQuotas("empresa-e");
    expect(result).toBe(true);
    expect(getTenantQuotas("empresa-e")).toEqual({});
  });

  it("retorna false para tenant inexistente", () => {
    expect(clearTenantQuotas("nao_existe")).toBe(false);
  });

  it("não afeta outros tenants", () => {
    setTenantQuota("empresa-e", "jobs_por_hora", 10);
    setTenantQuota("empresa-f", "dxf_por_hora", 5);
    clearTenantQuotas("empresa-e");
    expect(getTenantQuotas("empresa-f")["dxf_por_hora"]?.limite).toBe(5);
  });
});

// ─── listarTenantComQuotas ────────────────────────────────────────────────────

describe("listarTenantComQuotas", () => {
  it("retorna lista vazia quando não há tenants", () => {
    expect(listarTenantComQuotas()).toEqual([]);
  });

  it("retorna tenants com quotas configuradas", () => {
    setTenantQuota("t1", "jobs_por_hora", 10);
    setTenantQuota("t2", "dxf_por_hora", 5);
    const lista = listarTenantComQuotas();
    expect(lista).toContain("t1");
    expect(lista).toContain("t2");
    expect(lista).toHaveLength(2);
  });

  it("não inclui tenant após remoção total", () => {
    setTenantQuota("t3", "jobs_por_hora", 10);
    clearTenantQuotas("t3");
    expect(listarTenantComQuotas()).not.toContain("t3");
  });
});

// ─── checkAndConsumeQuota ─────────────────────────────────────────────────────

describe("checkAndConsumeQuota", () => {
  describe("sem quota configurada (comportamento permissivo)", () => {
    it("retorna permitido:true quando não há quota configurada", () => {
      const r = checkAndConsumeQuota("tenant-sem-quota", "jobs_por_hora");
      expect(r.permitido).toBe(true);
      expect(r.limite).toBeNull();
      expect(r.restante).toBeNull();
      expect(r.consumido).toBe(0);
    });
  });

  describe("dentro do limite", () => {
    it("retorna permitido:true e decrementa restante", () => {
      setTenantQuota("empresa-g", "jobs_por_hora", 5);
      const r = checkAndConsumeQuota("empresa-g", "jobs_por_hora");
      expect(r.permitido).toBe(true);
      expect(r.restante).toBe(4);
      expect(r.consumido).toBe(1);
      expect(r.limite).toBe(5);
    });

    it("acumula consumo em chamadas consecutivas", () => {
      setTenantQuota("empresa-g", "jobs_por_hora", 5);
      checkAndConsumeQuota("empresa-g", "jobs_por_hora");
      checkAndConsumeQuota("empresa-g", "jobs_por_hora");
      const r = checkAndConsumeQuota("empresa-g", "jobs_por_hora");
      expect(r.restante).toBe(2);
    });

    it("consome múltiplas unidades de uma vez", () => {
      setTenantQuota("empresa-g", "jobs_por_hora", 10);
      const r = checkAndConsumeQuota("empresa-g", "jobs_por_hora", 3);
      expect(r.consumido).toBe(3);
      expect(r.restante).toBe(7);
    });
  });

  describe("no limite exato (último slot)", () => {
    it("permite consumo até o limite exato", () => {
      setTenantQuota("empresa-h", "jobs_por_hora", 2);
      checkAndConsumeQuota("empresa-h", "jobs_por_hora");
      const r = checkAndConsumeQuota("empresa-h", "jobs_por_hora");
      expect(r.permitido).toBe(true);
      expect(r.restante).toBe(0);
    });
  });

  describe("quota excedida", () => {
    it("retorna permitido:false quando limite atingido", () => {
      setTenantQuota("empresa-i", "dxf_por_hora", 2);
      checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      const r = checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      expect(r.permitido).toBe(false);
      expect(r.consumido).toBe(0);
    });

    it("retorna permitido:false para limite zero", () => {
      setTenantQuota("empresa-i", "dxf_por_hora", 0);
      const r = checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      expect(r.permitido).toBe(false);
      expect(r.restante).toBe(0);
    });

    it("não consome quando bloqueado (idempotente)", () => {
      setTenantQuota("empresa-i", "dxf_por_hora", 1);
      checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      checkAndConsumeQuota("empresa-i", "dxf_por_hora"); // bloqueado
      checkAndConsumeQuota("empresa-i", "dxf_por_hora"); // bloqueado
      // Ainda bloqueado — consumo não cresceu
      const r = checkAndConsumeQuota("empresa-i", "dxf_por_hora");
      expect(r.permitido).toBe(false);
      expect(r.restante).toBe(0);
    });
  });

  describe("janela deslizante", () => {
    it("retorna resetEm como Date para quotas com janela", () => {
      setTenantQuota("empresa-j", "jobs_por_hora", 10);
      const r = checkAndConsumeQuota("empresa-j", "jobs_por_hora");
      expect(r.resetEm).toBeInstanceOf(Date);
    });

    it("retorna resetEm null para quotas cumulativas (armazenamento_mb)", () => {
      setTenantQuota("empresa-j", "armazenamento_mb", 1000);
      const r = checkAndConsumeQuota("empresa-j", "armazenamento_mb");
      expect(r.resetEm).toBeNull();
    });

    it("expira timestamps fora da janela via resetTenantUsage (reset manual)", () => {
      setTenantQuota("empresa-j", "jobs_por_hora", 2);
      checkAndConsumeQuota("empresa-j", "jobs_por_hora");
      checkAndConsumeQuota("empresa-j", "jobs_por_hora");
      // Após reset, quota volta a funcionar
      resetTenantUsage("empresa-j", "jobs_por_hora");
      const r = checkAndConsumeQuota("empresa-j", "jobs_por_hora");
      expect(r.permitido).toBe(true);
    });
  });

  describe("JANELA_QUOTA_MS", () => {
    it("expõe as janelas corretas para todos os tipos", () => {
      expect(JANELA_QUOTA_MS["jobs_por_hora"]).toBe(60 * 60 * 1_000);
      expect(JANELA_QUOTA_MS["jobs_por_dia"]).toBe(24 * 60 * 60 * 1_000);
      expect(JANELA_QUOTA_MS["dxf_por_hora"]).toBe(60 * 60 * 1_000);
      expect(JANELA_QUOTA_MS["analise_por_hora"]).toBe(60 * 60 * 1_000);
      expect(JANELA_QUOTA_MS["armazenamento_mb"]).toBe(Infinity);
    });
  });
});

// ─── getTenantUsageReport ─────────────────────────────────────────────────────

describe("getTenantUsageReport", () => {
  it("retorna relatório vazio para tenant sem quotas", () => {
    const r = getTenantUsageReport("tenant-sem-quota");
    expect(r.tenantId).toBe("tenant-sem-quota");
    expect(r.quotas).toEqual({});
  });

  it("retorna consumido=0 para quota configurada sem uso", () => {
    setTenantQuota("empresa-k", "jobs_por_hora", 10);
    const r = getTenantUsageReport("empresa-k");
    expect(r.quotas["jobs_por_hora"]?.consumido).toBe(0);
    expect(r.quotas["jobs_por_hora"]?.limite).toBe(10);
    expect(r.quotas["jobs_por_hora"]?.restante).toBe(10);
  });

  it("reflete uso após checkAndConsumeQuota", () => {
    setTenantQuota("empresa-k", "jobs_por_hora", 10);
    checkAndConsumeQuota("empresa-k", "jobs_por_hora");
    checkAndConsumeQuota("empresa-k", "jobs_por_hora");
    const r = getTenantUsageReport("empresa-k");
    expect(r.quotas["jobs_por_hora"]?.consumido).toBe(2);
    expect(r.quotas["jobs_por_hora"]?.restante).toBe(8);
  });

  it("normaliza tenantId no relatório", () => {
    setTenantQuota("empresa-l", "dxf_por_hora", 5);
    const r = getTenantUsageReport("  EMPRESA-L  ");
    expect(r.tenantId).toBe("empresa-l");
  });
});

// ─── resetTenantUsage / clearAllTenantQuotas ───────────────────────────────────

describe("resetTenantUsage", () => {
  it("reseta uso de tipo específico sem afetar outros tipos", () => {
    setTenantQuota("empresa-m", "jobs_por_hora", 5);
    setTenantQuota("empresa-m", "dxf_por_hora", 5);
    checkAndConsumeQuota("empresa-m", "jobs_por_hora", 3);
    checkAndConsumeQuota("empresa-m", "dxf_por_hora", 2);
    resetTenantUsage("empresa-m", "jobs_por_hora");
    const r = getTenantUsageReport("empresa-m");
    expect(r.quotas["jobs_por_hora"]?.consumido).toBe(0);
    expect(r.quotas["dxf_por_hora"]?.consumido).toBe(2);
  });
});

describe("clearAllTenantQuotas", () => {
  it("remove tudo da store", () => {
    setTenantQuota("t1", "jobs_por_hora", 10);
    setTenantQuota("t2", "dxf_por_hora", 5);
    clearAllTenantQuotas();
    expect(listarTenantComQuotas()).toHaveLength(0);
  });

  it("não lança erro quando store já está vazia", () => {
    expect(() => clearAllTenantQuotas()).not.toThrow();
  });
});
