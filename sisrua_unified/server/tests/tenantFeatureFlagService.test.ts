/**
 * tenantFeatureFlagService.test.ts
 * Testes unitários do serviço de feature flags por tenant (Roadmap Item 21 [T2]).
 */

import {
  setTenantFlagOverrides,
  getTenantFlagOverrides,
  getTenantFlagValue,
  removeTenantFlag,
  clearTenantFlagOverrides,
  listConfiguredTenants,
  clearAllTenantFlagOverrides,
} from "../services/tenantFeatureFlagService.js";

beforeEach(() => {
  clearAllTenantFlagOverrides();
});

describe("tenantFeatureFlagService", () => {
  // ─── setTenantFlagOverrides ────────────────────────────────────────────────

  describe("setTenantFlagOverrides", () => {
    it("define overrides para um tenant novo", () => {
      setTenantFlagOverrides("tenant-a", { bt_topology_editor: true });
      expect(getTenantFlagValue("tenant-a", "bt_topology_editor")).toBe(true);
    });

    it("faz merge incremental ao chamar duas vezes", () => {
      setTenantFlagOverrides("tenant-a", { feat1: true });
      setTenantFlagOverrides("tenant-a", { feat2: false });
      expect(getTenantFlagValue("tenant-a", "feat1")).toBe(true);
      expect(getTenantFlagValue("tenant-a", "feat2")).toBe(false);
    });

    it("sobrescreve flag existente no merge incremental", () => {
      setTenantFlagOverrides("tenant-a", { feat1: true });
      setTenantFlagOverrides("tenant-a", { feat1: false });
      expect(getTenantFlagValue("tenant-a", "feat1")).toBe(false);
    });

    it("normaliza tenantId para lowercase com trim", () => {
      setTenantFlagOverrides("  Tenant-B  ", { feat1: true });
      expect(getTenantFlagValue("tenant-b", "feat1")).toBe(true);
    });

    it("aceita múltiplos tenants independentes", () => {
      setTenantFlagOverrides("t1", { feat1: true });
      setTenantFlagOverrides("t2", { feat1: false });
      expect(getTenantFlagValue("t1", "feat1")).toBe(true);
      expect(getTenantFlagValue("t2", "feat1")).toBe(false);
    });
  });

  // ─── getTenantFlagOverrides ────────────────────────────────────────────────

  describe("getTenantFlagOverrides", () => {
    it("retorna objeto vazio para tenant sem overrides", () => {
      const flags = getTenantFlagOverrides("inexistente");
      expect(flags).toEqual({});
    });

    it("retorna todos os overrides configurados", () => {
      setTenantFlagOverrides("tenant-c", { feat1: true, feat2: false });
      const flags = getTenantFlagOverrides("tenant-c");
      expect(flags).toEqual({ feat1: true, feat2: false });
    });

    it("retorna cópia congelada (mutação lança TypeError em strict mode)", () => {
      setTenantFlagOverrides("tenant-c", { feat1: true });
      const flags = getTenantFlagOverrides("tenant-c") as Record<string, boolean>;
      expect(() => {
        flags["feat1"] = false;
      }).toThrow(TypeError);
      // Store não deve ter sido alterada
      expect(getTenantFlagValue("tenant-c", "feat1")).toBe(true);
    });

    it("normaliza tenantId ao buscar", () => {
      setTenantFlagOverrides("tenant-d", { feat1: true });
      const flags = getTenantFlagOverrides("  TENANT-D  ");
      expect(flags).toEqual({ feat1: true });
    });
  });

  // ─── getTenantFlagValue ────────────────────────────────────────────────────

  describe("getTenantFlagValue", () => {
    it("retorna null quando tenant não existe", () => {
      expect(getTenantFlagValue("inexistente", "qualquer")).toBeNull();
    });

    it("retorna null quando flag não existe no tenant", () => {
      setTenantFlagOverrides("tenant-e", { feat1: true });
      expect(getTenantFlagValue("tenant-e", "feat_inexistente")).toBeNull();
    });

    it("retorna true quando flag está habilitado", () => {
      setTenantFlagOverrides("tenant-e", { feat1: true });
      expect(getTenantFlagValue("tenant-e", "feat1")).toBe(true);
    });

    it("retorna false quando flag está desabilitado", () => {
      setTenantFlagOverrides("tenant-e", { feat1: false });
      expect(getTenantFlagValue("tenant-e", "feat1")).toBe(false);
    });

    it("normaliza tenantId ao buscar valor", () => {
      setTenantFlagOverrides("tenant-f", { feat1: true });
      expect(getTenantFlagValue("  TENANT-F  ", "feat1")).toBe(true);
    });
  });

  // ─── removeTenantFlag ─────────────────────────────────────────────────────

  describe("removeTenantFlag", () => {
    it("remove flag específico de tenant existente", () => {
      setTenantFlagOverrides("tenant-g", { feat1: true, feat2: false });
      removeTenantFlag("tenant-g", "feat1");
      expect(getTenantFlagValue("tenant-g", "feat1")).toBeNull();
      expect(getTenantFlagValue("tenant-g", "feat2")).toBe(false);
    });

    it("remove a entrada do tenant se ficar sem overrides", () => {
      setTenantFlagOverrides("tenant-g", { feat1: true });
      removeTenantFlag("tenant-g", "feat1");
      expect(listConfiguredTenants()).not.toContain("tenant-g");
    });

    it("não lança erro ao remover flag inexistente em tenant existente", () => {
      setTenantFlagOverrides("tenant-g", { feat1: true });
      expect(() => removeTenantFlag("tenant-g", "feat_nao_existe")).not.toThrow();
    });

    it("não lança erro ao remover flag de tenant inexistente", () => {
      expect(() => removeTenantFlag("tenant_nao_existe", "feat1")).not.toThrow();
    });

    it("normaliza tenantId ao remover flag", () => {
      setTenantFlagOverrides("tenant-h", { feat1: true });
      removeTenantFlag("  TENANT-H  ", "feat1");
      expect(getTenantFlagValue("tenant-h", "feat1")).toBeNull();
    });
  });

  // ─── clearTenantFlagOverrides ──────────────────────────────────────────────

  describe("clearTenantFlagOverrides", () => {
    it("retorna true e remove todos os overrides do tenant", () => {
      setTenantFlagOverrides("tenant-i", { feat1: true, feat2: false });
      const result = clearTenantFlagOverrides("tenant-i");
      expect(result).toBe(true);
      expect(getTenantFlagOverrides("tenant-i")).toEqual({});
    });

    it("retorna false para tenant inexistente", () => {
      const result = clearTenantFlagOverrides("nao_existe");
      expect(result).toBe(false);
    });

    it("não afeta outros tenants", () => {
      setTenantFlagOverrides("tenant-i", { feat1: true });
      setTenantFlagOverrides("tenant-j", { feat2: false });
      clearTenantFlagOverrides("tenant-i");
      expect(getTenantFlagValue("tenant-j", "feat2")).toBe(false);
    });
  });

  // ─── listConfiguredTenants ────────────────────────────────────────────────

  describe("listConfiguredTenants", () => {
    it("retorna lista vazia quando não há tenants configurados", () => {
      expect(listConfiguredTenants()).toEqual([]);
    });

    it("retorna os tenants que possuem overrides", () => {
      setTenantFlagOverrides("t1", { feat1: true });
      setTenantFlagOverrides("t2", { feat2: false });
      const lista = listConfiguredTenants();
      expect(lista).toContain("t1");
      expect(lista).toContain("t2");
      expect(lista).toHaveLength(2);
    });

    it("não inclui tenant após remoção total de overrides", () => {
      setTenantFlagOverrides("t3", { feat1: true });
      clearTenantFlagOverrides("t3");
      expect(listConfiguredTenants()).not.toContain("t3");
    });

    it("não inclui tenant após remoção do último flag individual", () => {
      setTenantFlagOverrides("t4", { feat1: true });
      removeTenantFlag("t4", "feat1");
      expect(listConfiguredTenants()).not.toContain("t4");
    });
  });

  // ─── clearAllTenantFlagOverrides ──────────────────────────────────────────

  describe("clearAllTenantFlagOverrides", () => {
    it("remove todos os tenants da store", () => {
      setTenantFlagOverrides("t1", { feat1: true });
      setTenantFlagOverrides("t2", { feat2: false });
      clearAllTenantFlagOverrides();
      expect(listConfiguredTenants()).toHaveLength(0);
    });

    it("não lança erro quando store já está vazia", () => {
      expect(() => clearAllTenantFlagOverrides()).not.toThrow();
    });
  });

  // ─── normalizeTenantId — validação de vazio ────────────────────────────────

  describe("normalizeTenantId (via setTenantFlagOverrides)", () => {
    it("lança erro para tenantId composto apenas de espaços", () => {
      expect(() => setTenantFlagOverrides("   ", { feat1: true })).toThrow();
    });

    it("lança erro para tenantId string vazia", () => {
      expect(() => setTenantFlagOverrides("", { feat1: true })).toThrow();
    });
  });
});
