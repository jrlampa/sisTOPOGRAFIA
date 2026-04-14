/**
 * Item 115 – Feature Flags por Tenant
 *
 * Controle de funcionalidades por tenant (cliente/organização).
 * Flags globais definidas como constantes; overrides por tenant em memória.
 * Integração com Postgres stublada para persistência futura.
 */

import { logger } from "../utils/logger.js";

// ── Enum de chaves de feature flags ──────────────────────────────────────────

export enum FeatureKey {
  /** Cálculo radial de baixa tensão */
  BT_RADIAL_ENABLED = "bt_radial_enabled",

  /** Snapshots de domínio (Digital Twin) */
  DOMAIN_SNAPSHOTS_ENABLED = "domain_snapshots_enabled",

  /** Exportação de artefatos DXF com hash de integridade */
  DXF_INTEGRITY_HASH_ENABLED = "dxf_integrity_hash_enabled",

  /** Validação de topologia em tempo real */
  TOPOLOGY_VALIDATION_ENABLED = "topology_validation_enabled",

  /** Circuit breakers para APIs externas */
  CIRCUIT_BREAKERS_ENABLED = "circuit_breakers_enabled",

  /** Detecção de anomalias (Z-score) */
  ANOMALY_DETECTION_ENABLED = "anomaly_detection_enabled",

  /** SBOM policy gate na CI */
  SBOM_POLICY_GATE_ENABLED = "sbom_policy_gate_enabled",

  /** Interface de gerenciamento de usuários (admin) */
  USER_MANAGEMENT_UI_ENABLED = "user_management_ui_enabled",

  /** Exportação para formatos legados */
  LEGACY_EXPORT_ENABLED = "legacy_export_enabled",

  /** API de métricas pública (sem autenticação) */
  PUBLIC_METRICS_ENABLED = "public_metrics_enabled",
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FeatureFlagMap = Record<FeatureKey, boolean>;

export interface FeatureFlagEntry {
  key: FeatureKey;
  value: boolean;
  tenantId?: string;
  updatedAt: Date;
  updatedBy?: string;
}

// ── Flags globais padrão ──────────────────────────────────────────────────────

const DEFAULT_FLAGS: FeatureFlagMap = {
  [FeatureKey.BT_RADIAL_ENABLED]: true,
  [FeatureKey.DOMAIN_SNAPSHOTS_ENABLED]: true,
  [FeatureKey.DXF_INTEGRITY_HASH_ENABLED]: true,
  [FeatureKey.TOPOLOGY_VALIDATION_ENABLED]: true,
  [FeatureKey.CIRCUIT_BREAKERS_ENABLED]: true,
  [FeatureKey.ANOMALY_DETECTION_ENABLED]: false, // Opt-in
  [FeatureKey.SBOM_POLICY_GATE_ENABLED]: true,
  [FeatureKey.USER_MANAGEMENT_UI_ENABLED]: false, // Somente admin
  [FeatureKey.LEGACY_EXPORT_ENABLED]: false,
  [FeatureKey.PUBLIC_METRICS_ENABLED]: false,
};

// ── Armazenamento em memória ──────────────────────────────────────────────────

/**
 * Overrides por tenant: tenantId → mapa de (FeatureKey → valor)
 * Um override null/undefined significa "usar o padrão global".
 */
const tenantOverrides = new Map<string, Partial<FeatureFlagMap>>();

// Histórico de alterações para auditoria
const auditLog: FeatureFlagEntry[] = [];

// ── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Verifica se uma feature está habilitada para o tenant informado.
 * Overrides de tenant têm prioridade sobre os defaults globais.
 */
function isFeatureEnabled(featureKey: FeatureKey, tenantId?: string): boolean {
  if (tenantId) {
    const overrides = tenantOverrides.get(tenantId);
    if (overrides && featureKey in overrides) {
      return overrides[featureKey] ?? DEFAULT_FLAGS[featureKey];
    }
  }

  return DEFAULT_FLAGS[featureKey] ?? false;
}

/**
 * Retorna todas as feature flags para o tenant informado.
 * Mescla os defaults globais com os overrides do tenant.
 */
function getFeatureFlags(tenantId?: string): FeatureFlagMap {
  const flags = { ...DEFAULT_FLAGS };

  if (tenantId) {
    const overrides = tenantOverrides.get(tenantId) ?? {};
    Object.assign(flags, overrides);
  }

  return flags;
}

/**
 * Define o valor de uma feature flag para um tenant (ou globalmente).
 * Operação administrativa – deve ser protegida por verificação de papel.
 */
function setFeatureFlag(
  featureKey: FeatureKey,
  value: boolean,
  tenantId?: string,
  updatedBy?: string,
): void {
  const entry: FeatureFlagEntry = {
    key: featureKey,
    value,
    tenantId,
    updatedAt: new Date(),
    updatedBy,
  };

  if (tenantId) {
    const current = tenantOverrides.get(tenantId) ?? {};
    current[featureKey] = value;
    tenantOverrides.set(tenantId, current);

    logger.info("Feature flag alterada para tenant", {
      featureKey,
      value,
      tenantId,
      updatedBy,
    });
  } else {
    // Override global (modifica o runtime, não o objeto DEFAULT_FLAGS constante)
    (DEFAULT_FLAGS as Record<string, boolean>)[featureKey] = value;

    logger.info("Feature flag global alterada", {
      featureKey,
      value,
      updatedBy,
    });
  }

  auditLog.push(entry);

  // Stub: persistir no Postgres
  // await persistFlagToPostgres(entry);
}

/**
 * Remove o override de tenant, revertendo ao default global.
 */
function resetFeatureFlag(featureKey: FeatureKey, tenantId: string): void {
  const overrides = tenantOverrides.get(tenantId);
  if (overrides) {
    delete overrides[featureKey];
    logger.info("Feature flag de tenant resetada para padrão global", {
      featureKey,
      tenantId,
    });
  }
}

/**
 * Retorna o histórico de alterações de flags (últimas N entradas).
 */
function getAuditLog(limit = 50): FeatureFlagEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Lista todos os tenants que possuem overrides configurados.
 */
function listTenantsWithOverrides(): string[] {
  return [...tenantOverrides.keys()];
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const featureFlagService = {
  isFeatureEnabled,
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlag,
  getAuditLog,
  listTenantsWithOverrides,
} as const;
