/**
 * tenantFeatureFlagService.ts — Controle de feature flags por tenant.
 *
 * Roadmap Item 21 [T2]: Feature Flags por Tenant.
 * Permite controle granular de funcionalidades e estágios de roll-out por cliente corporativo.
 *
 * Estratégia de armazenamento:
 *   - Store em memória (Map), sem dependência de banco de dados.
 *   - Em produção, pode ser evoluído para leitura de banco de dados, Redis ou config server.
 *
 * Prioridade de resolução (do menor ao maior):
 *   global defaults → grupo → região → tenant (maior prioridade)
 *
 * Uso:
 *   setTenantFlagOverrides('tenant-abc', { bt_topology_editor: false, dxf_export: true })
 *   getTenantFlagValue('tenant-abc', 'bt_topology_editor') // → false
 */

/** Identificador único de tenant (UUID, slug ou string opaca). */
export type TenantId = string;

/**
 * Mapa de feature flags para um tenant.
 * Chave: nome do feature (string idêntica aos valores de FeatureFlag do frontend).
 * Valor: booleano indicando se o feature está habilitado para este tenant.
 */
export type TenantFlagMap = Record<string, boolean>;

// ─── Store em memória ─────────────────────────────────────────────────────────

/** Store principal: tenantId → mapa de overrides de features. */
const tenantStore = new Map<TenantId, TenantFlagMap>();

// ─── Helpers internos ─────────────────────────────────────────────────────────

function normalizeTenantId(id: TenantId): TenantId {
  return id.trim().toLowerCase();
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Define ou atualiza overrides de feature flags para um tenant.
 * Merge incremental: apenas as chaves fornecidas são alteradas.
 *
 * @param tenantId  Identificador do tenant.
 * @param flags     Mapa de chave→boolean com os overrides a aplicar.
 */
export function setTenantFlagOverrides(
  tenantId: TenantId,
  flags: TenantFlagMap,
): void {
  const key = normalizeTenantId(tenantId);
  const existing = tenantStore.get(key) ?? {};
  tenantStore.set(key, { ...existing, ...flags });
}

/**
 * Retorna todos os overrides configurados para um tenant.
 * Retorna objeto vazio (congelado) se o tenant não tiver overrides.
 */
export function getTenantFlagOverrides(
  tenantId: TenantId,
): Readonly<TenantFlagMap> {
  const key = normalizeTenantId(tenantId);
  return Object.freeze({ ...(tenantStore.get(key) ?? {}) });
}

/**
 * Verifica se uma feature específica tem override para um tenant.
 *
 * @returns `true` ou `false` se houver override; `null` se não houver override configurado.
 */
export function getTenantFlagValue(
  tenantId: TenantId,
  flag: string,
): boolean | null {
  const key = normalizeTenantId(tenantId);
  const flags = tenantStore.get(key);
  if (!flags || !(flag in flags)) {
    return null;
  }
  return flags[flag];
}

/**
 * Remove um override específico de um tenant.
 * Se o tenant ficar sem overrides, a entrada é removida da store.
 */
export function removeTenantFlag(tenantId: TenantId, flag: string): void {
  const key = normalizeTenantId(tenantId);
  const flags = tenantStore.get(key);
  if (!flags || !(flag in flags)) {
    return;
  }
  delete flags[flag];
  if (Object.keys(flags).length === 0) {
    tenantStore.delete(key);
  }
}

/**
 * Remove todos os overrides de um tenant.
 *
 * @returns `true` se o tenant existia e foi removido; `false` se não existia.
 */
export function clearTenantFlagOverrides(tenantId: TenantId): boolean {
  const key = normalizeTenantId(tenantId);
  return tenantStore.delete(key);
}

/**
 * Lista os tenantIds que possuem overrides configurados.
 */
export function listConfiguredTenants(): TenantId[] {
  return Array.from(tenantStore.keys());
}

/**
 * Remove todos os overrides de todos os tenants.
 * Destinado principalmente a uso em testes.
 */
export function clearAllTenantFlagOverrides(): void {
  tenantStore.clear();
}
