/**
 * Feature Flags para controlar funcionalidades experimentais (Item 20).
 * Permite habilitar/desabilitar CQT, BT topology, e outras features
 * sem modificar código.
 * 
 * Estratégia:
 * - Produção: valores do environment ou arquivo config/
 * - Desenvolvimento: flags podem ser alteradas em runtime
 * - Testes: simulação de features ativadas/desativadas
 */

export enum FeatureFlag {
  /** Análise de clandestinos (CQT) */
  CQT_ANALYSIS = 'cqt_analysis',
  
  /** Editor de topologia de BT */
  BT_TOPOLOGY_EDITOR = 'bt_topology_editor',
  
  /** Exportação de DXF */
  DXF_EXPORT = 'dxf_export',
  
  /** Importação de KML */
  KML_IMPORT = 'kml_import',
  
  /** Perfil de elevação */
  ELEVATION_PROFILE = 'elevation_profile',
  
  /** Análise de clandestinos com IA (Groq) */
  AI_CLANDESTINO_ANALYSIS = 'ai_clandestino_analysis',
  
  /** Suporte a múltiplos cenários de projeto (proj1, proj2) */
  MULTI_SCENARIO_SUPPORT = 'multi_scenario_support',
  
  /** Modo debug com logs verbosos */
  DEBUG_MODE = 'debug_mode',
}

type FeatureFlagConfig = Record<FeatureFlag, boolean>;
type FeatureFlagOverrideConfig = Partial<Record<string, unknown>>;
type FeatureFlagOverrideValue = boolean | string;

const VALID_FEATURE_FLAGS = new Set<FeatureFlag>(
  Object.values(FeatureFlag) as FeatureFlag[],
);

const APP_ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const IS_PRODUCTION = APP_ENV.PROD === true || APP_ENV.MODE === 'production';
const IS_DEVELOPMENT = APP_ENV.DEV === true || APP_ENV.MODE === 'development';

/**
 * Configuração padrão para desenvolvimento.
 * Todos os features habilitados.
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  [FeatureFlag.CQT_ANALYSIS]: true,
  [FeatureFlag.BT_TOPOLOGY_EDITOR]: true,
  [FeatureFlag.DXF_EXPORT]: true,
  [FeatureFlag.KML_IMPORT]: true,
  [FeatureFlag.ELEVATION_PROFILE]: true,
  [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: true,
  [FeatureFlag.MULTI_SCENARIO_SUPPORT]: true,
  [FeatureFlag.DEBUG_MODE]: IS_DEVELOPMENT,
};

/**
 * Configuração para produção.
 * Alguns features podem estar desabilitados por estabilidade.
 */
const PRODUCTION_FEATURE_FLAGS: FeatureFlagConfig = {
  [FeatureFlag.CQT_ANALYSIS]: true,
  [FeatureFlag.BT_TOPOLOGY_EDITOR]: true,
  [FeatureFlag.DXF_EXPORT]: true,
  [FeatureFlag.KML_IMPORT]: false, // Desabilitado em prod por enquanto
  [FeatureFlag.ELEVATION_PROFILE]: true,
  [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: false, // Custo de API, controlar via env
  [FeatureFlag.MULTI_SCENARIO_SUPPORT]: false, // Em desenvolvimento
  [FeatureFlag.DEBUG_MODE]: false,
};

/**
 * State gerenciável de flags em runtime (para desenvolvimento).
 * Em produção, deve ser read-only e carregado de env/config.
 */
let runtimeFlags: FeatureFlagConfig = {
  ...(IS_PRODUCTION
    ? PRODUCTION_FEATURE_FLAGS
    : DEFAULT_FEATURE_FLAGS),
};

/**
 * Carregar flags personalizado a partir de environment ou JSON.
 * @example
 * loadFeatureFlags({
 *   [FeatureFlag.BT_TOPOLOGY_EDITOR]: false,
 *   [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: true,
 * })
 */
export function loadFeatureFlags(customFlags: FeatureFlagOverrideConfig): void {
  if (IS_PRODUCTION && Object.keys(customFlags).length > 0) {
    throw new Error(
      'Feature flags customizadas não podem ser alteradas em produção. Use env vars.'
    );
  }

  const sanitizedCustomFlags = sanitizeOverrideConfig(customFlags);

  runtimeFlags = { ...runtimeFlags, ...sanitizedCustomFlags };
}

function normalizeOverrideBoolean(value: string): FeatureFlagOverrideValue {
  return value.trim().toLowerCase();
}

function sanitizeOverrideConfig(
  overrides: FeatureFlagOverrideConfig,
): Partial<Record<FeatureFlag, boolean>> {
  return Object.entries(overrides).reduce((acc, [key, rawValue]) => {
    const featureFlagKey = key as FeatureFlag;

    if (!VALID_FEATURE_FLAGS.has(featureFlagKey)) {
      console.warn(`[FeatureFlags] Chave de override desconhecida ignorada: ${key}`);
      return acc;
    }

    let parsedValue: boolean | null = null;

    if (typeof rawValue === 'boolean') {
      parsedValue = rawValue;
    } else if (typeof rawValue === 'string') {
      const normalizedValue = normalizeOverrideBoolean(rawValue);
      if (normalizedValue === 'true') {
        parsedValue = true;
      } else if (normalizedValue === 'false') {
        parsedValue = false;
      }
    }

    if (parsedValue === null) {
      console.warn(
        `[FeatureFlags] Valor inválido para override "${key}". Esperado boolean, recebido ${typeof rawValue}.`,
      );
      return acc;
    }

    acc[featureFlagKey] = parsedValue;
    return acc;
  }, {} as Partial<Record<FeatureFlag, boolean>>);
}

/**
 * Verificar se uma feature está habilitada.
 * @example
 * if (isFeatureEnabled(FeatureFlag.BT_TOPOLOGY_EDITOR)) {
 *   // renderizar editor
 * }
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return runtimeFlags[flag] ?? false;
}

/**
 * Acessar todos os flags (read-only em produção).
 */
export function getAllFeatureFlags(): Readonly<FeatureFlagConfig> {
  return Object.freeze({ ...runtimeFlags });
}

/**
 * Toggle um flag em desenvolvimento.
 * NÃO deve ser chamado em produção.
 */
export function toggleFeatureFlag(flag: FeatureFlag): boolean {
  if (IS_PRODUCTION) {
    throw new Error(
      'Feature flags não podem ser alterados em produção. Configure via env vars.'
    );
  }
  
  runtimeFlags[flag] = !runtimeFlags[flag];
  
  if (runtimeFlags[FeatureFlag.DEBUG_MODE]) {
    console.log(`[FeatureFlags] ${flag} = ${runtimeFlags[flag]}`);
  }
  
  return runtimeFlags[flag];
}

/**
 * Reset para flags padrão (útil em testes).
 */
export function resetFeatureFlags(): void {
  runtimeFlags =
    IS_PRODUCTION
      ? { ...PRODUCTION_FEATURE_FLAGS }
      : { ...DEFAULT_FEATURE_FLAGS };
}

/**
 * Hook React para monitorar feature flags.
 * Reativa (sem estado, apenas checkagem).
 * 
 * @example
 * function MyComponent() {
 *   if (!useFeatureFlag(FeatureFlag.BT_TOPOLOGY_EDITOR)) {
 *     return <ComingSoon />;
 *   }
 *   return <BtEditor />;
 * }
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag);
}
