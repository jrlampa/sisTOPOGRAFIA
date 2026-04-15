/**
 * tenantQuotaService.ts — Quotas e Throttling Customizado por Tenant.
 *
 * Roadmap Item 33 [T2]: Quotas e Throttling Customizado.
 * Limites de processamento e armazenamento segregados por grupo empresarial.
 *
 * Estratégia:
 *   - Store em memória (Map). Em produção, evoluir para Redis ou banco.
 *   - Janela deslizante (sliding window) por tipo de quota e tenant.
 *   - Independente do rate limiter global (IP/usuário) existente.
 *
 * Tipos de quota disponíveis:
 *   - jobs_por_hora     — geração de DXF / jobs de geoprocessamento por hora
 *   - jobs_por_dia      — jobs por dia (janela 24 h)
 *   - dxf_por_hora      — exportações DXF por hora
 *   - analise_por_hora  — análises de rede/topologia por hora
 *   - armazenamento_mb  — armazenamento máximo em MB (limite fixo, não janela)
 *
 * Uso:
 *   setTenantQuota('empresa-abc', 'jobs_por_hora', 50)
 *   const r = checkAndConsumeQuota('empresa-abc', 'jobs_por_hora')
 *   // → { permitido: true, restante: 49, resetEm: Date, consumido: 1 }
 */

/** Identificador único de tenant. */
export type TenantId = string;

/** Tipos de quota suportados. */
export type TipoQuota =
  | "jobs_por_hora"
  | "jobs_por_dia"
  | "dxf_por_hora"
  | "analise_por_hora"
  | "armazenamento_mb";

/** Janela de tempo em ms associada a cada tipo de quota. */
export const JANELA_QUOTA_MS: Record<TipoQuota, number> = {
  jobs_por_hora: 60 * 60 * 1_000,
  jobs_por_dia: 24 * 60 * 60 * 1_000,
  dxf_por_hora: 60 * 60 * 1_000,
  analise_por_hora: 60 * 60 * 1_000,
  armazenamento_mb: Infinity, // limite fixo, sem janela temporal
};

/** Configuração de limite para uma quota. */
export interface ConfigQuota {
  limite: number;
  /** Se `true`, a quota de armazenamento é tratada como cumulativa (sem janela). */
  cumulativa?: boolean;
}

/** Mapa de configurações de quota de um tenant. */
export type MapaQuotaTenant = Partial<Record<TipoQuota, ConfigQuota>>;

/** Resultado de uma verificação e consumo de quota. */
export interface ResultadoVerificacaoQuota {
  /** Indica se a operação está permitida dentro da quota. */
  permitido: boolean;
  /** Unidades restantes antes de atingir o limite (após consumo, se permitido). */
  restante: number;
  /** Limite configurado para este tipo de quota. */
  limite: number;
  /** Número de unidades consumidas nesta chamada (0 se bloqueado). */
  consumido: number;
  /** Data/hora em que a janela será resetada (apenas para quotas com janela temporal). */
  resetEm: Date | null;
}

/** Relatório de uso de um tenant. */
export interface RelatorioUsoTenant {
  tenantId: TenantId;
  quotas: Record<
    string,
    {
      limite: number;
      consumido: number;
      restante: number;
      resetEm: Date | null;
    }
  >;
}

// ─── Stores internas ──────────────────────────────────────────────────────────

/** Store de configurações de quota por tenant. */
const quotaStore = new Map<TenantId, MapaQuotaTenant>();

/**
 * Store de eventos de uso para janela deslizante.
 * Chave: `${tenantId}::${tipoQuota}` → array de timestamps de consumo.
 */
const usageStore = new Map<string, number[]>();

// ─── Helpers internos ─────────────────────────────────────────────────────────

function normalizarTenantId(id: TenantId): TenantId {
  const normalizado = id.trim().toLowerCase();
  if (normalizado.length === 0) {
    throw new Error("tenantId não pode ser vazio ou conter apenas espaços");
  }
  return normalizado;
}

function chaveUso(tenantId: TenantId, tipo: TipoQuota): string {
  return `${tenantId}::${tipo}`;
}

/**
 * Remove timestamps fora da janela deslizante e retorna os válidos.
 */
function filtrarJanela(
  timestamps: number[],
  tipo: TipoQuota,
  agora: number,
): number[] {
  const janela = JANELA_QUOTA_MS[tipo];
  if (!isFinite(janela)) {
    return timestamps; // cumulativo — nunca expira
  }
  return timestamps.filter((ts) => agora - ts < janela);
}

/**
 * Calcula a data de reset da janela deslizante com base no evento mais antigo.
 */
function calcularResetEm(
  timestamps: number[],
  tipo: TipoQuota,
): Date | null {
  const janela = JANELA_QUOTA_MS[tipo];
  if (!isFinite(janela) || timestamps.length === 0) {
    return null;
  }
  return new Date(timestamps[0] + janela);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Define ou atualiza o limite de uma quota específica para um tenant.
 *
 * @param tenantId  Identificador do tenant.
 * @param tipo      Tipo de quota a configurar.
 * @param limite    Limite máximo de unidades.
 */
export function setTenantQuota(
  tenantId: TenantId,
  tipo: TipoQuota,
  limite: number,
): void {
  if (!Number.isFinite(limite) || limite < 0) {
    throw new RangeError(
      `Limite de quota deve ser um número não-negativo finito (recebido: ${limite})`,
    );
  }
  const key = normalizarTenantId(tenantId);
  const existente = quotaStore.get(key) ?? {};
  const cumulativa = !isFinite(JANELA_QUOTA_MS[tipo]);
  quotaStore.set(key, {
    ...existente,
    [tipo]: { limite, cumulativa },
  });
}

/**
 * Retorna as configurações de quota de um tenant.
 * Retorna objeto vazio se não houver configurações.
 */
export function getTenantQuotas(tenantId: TenantId): Readonly<MapaQuotaTenant> {
  const key = normalizarTenantId(tenantId);
  return Object.freeze({ ...(quotaStore.get(key) ?? {}) });
}

/**
 * Remove a configuração de uma quota específica de um tenant.
 * Também limpa o histórico de uso associado.
 */
export function removeTenantQuota(tenantId: TenantId, tipo: TipoQuota): void {
  const key = normalizarTenantId(tenantId);
  const config = quotaStore.get(key);
  if (!config) return;
  delete config[tipo];
  if (Object.keys(config).length === 0) {
    quotaStore.delete(key);
  }
  usageStore.delete(chaveUso(key, tipo));
}

/**
 * Remove todas as configurações e histórico de uso de um tenant.
 *
 * @returns `true` se o tenant existia; `false` caso contrário.
 */
export function clearTenantQuotas(tenantId: TenantId): boolean {
  const key = normalizarTenantId(tenantId);
  const existia = quotaStore.has(key);
  quotaStore.delete(key);
  // Remove todos os registros de uso deste tenant
  for (const storeKey of usageStore.keys()) {
    if (storeKey.startsWith(`${key}::`)) {
      usageStore.delete(storeKey);
    }
  }
  return existia;
}

/**
 * Lista os tenantIds com quotas configuradas.
 */
export function listarTenantComQuotas(): TenantId[] {
  return Array.from(quotaStore.keys());
}

/**
 * Verifica se uma operação está dentro da quota e, se permitida, a consome.
 *
 * Para quotas sem configuração de tenant, retorna `permitido: true` sem consumo
 * (comportamento permissivo — tenant não gerenciado não é bloqueado).
 *
 * @param tenantId  Identificador do tenant.
 * @param tipo      Tipo de quota a verificar.
 * @param unidades  Unidades a consumir (padrão 1).
 */
export function checkAndConsumeQuota(
  tenantId: TenantId,
  tipo: TipoQuota,
  unidades = 1,
): ResultadoVerificacaoQuota {
  const key = normalizarTenantId(tenantId);
  const config = quotaStore.get(key);
  if (!config || !config[tipo]) {
    // Sem quota configurada → permissivo
    return {
      permitido: true,
      restante: Infinity,
      limite: Infinity,
      consumido: 0,
      resetEm: null,
    };
  }

  const { limite } = config[tipo]!;
  const agora = Date.now();
  const chave = chaveUso(key, tipo);
  const raw = usageStore.get(chave) ?? [];
  const ativos = filtrarJanela(raw, tipo, agora);

  const consumidoAtual = ativos.length;
  const novoTotal = consumidoAtual + unidades;

  if (novoTotal > limite) {
    usageStore.set(chave, ativos); // grava versão filtrada (sem expirados)
    const resetEm = calcularResetEm(ativos, tipo);
    return {
      permitido: false,
      restante: Math.max(0, limite - consumidoAtual),
      limite,
      consumido: 0,
      resetEm,
    };
  }

  // Registra o(s) novo(s) evento(s) de consumo
  const novosTimestamps = Array.from({ length: unidades }, () => agora);
  usageStore.set(chave, [...ativos, ...novosTimestamps]);

  const resetEm = calcularResetEm([...ativos, ...novosTimestamps], tipo);
  return {
    permitido: true,
    restante: limite - novoTotal,
    limite,
    consumido: unidades,
    resetEm,
  };
}

/**
 * Retorna o relatório de uso atual de um tenant para todas as quotas configuradas.
 */
export function getTenantUsageReport(
  tenantId: TenantId,
): RelatorioUsoTenant {
  const key = normalizarTenantId(tenantId);
  const config = quotaStore.get(key) ?? {};
  const agora = Date.now();
  const quotasReport: RelatorioUsoTenant["quotas"] = {};

  for (const [tipo, cfg] of Object.entries(config) as [TipoQuota, ConfigQuota][]) {
    const chave = chaveUso(key, tipo);
    const raw = usageStore.get(chave) ?? [];
    const ativos = filtrarJanela(raw, tipo, agora);
    const consumido = ativos.length;
    quotasReport[tipo] = {
      limite: cfg.limite,
      consumido,
      restante: Math.max(0, cfg.limite - consumido),
      resetEm: calcularResetEm(ativos, tipo),
    };
  }

  return { tenantId: key, quotas: quotasReport };
}

/**
 * Reseta o histórico de uso de um tenant para um tipo específico.
 * Destinado a uso em testes e operações administrativas de emergência.
 */
export function resetTenantUsage(tenantId: TenantId, tipo: TipoQuota): void {
  const key = normalizarTenantId(tenantId);
  usageStore.delete(chaveUso(key, tipo));
}

/**
 * Remove todas as configurações e histórico de todos os tenants.
 * Destinado exclusivamente a uso em testes.
 */
export function clearAllTenantQuotas(): void {
  quotaStore.clear();
  usageStore.clear();
}
