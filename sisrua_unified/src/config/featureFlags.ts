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
type FeatureFlagOverrideConfig = Partial<Record<FeatureFlag, boolean>>;

export interface FeatureFlagContext {
  /** Grupo de usuário (ex: 'engenharia', 'operacao', 'viewer') */
  userGroup?: string;
  /** Regional/região (ex: 'sul', 'sudeste', 'nordeste') */
  region?: string;
}

export interface FeatureFlagTargetingConfig {
  /** Overrides por grupo de usuário */
  userGroups?: Record<string, FeatureFlagOverrideConfig>;
  /** Overrides por região */
  regions?: Record<string, FeatureFlagOverrideConfig>;
}

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

let runtimeTargeting: Required<FeatureFlagTargetingConfig> = {
  userGroups: {},
  regions: {},
};

function normalizeContextKey(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeOverrideConfig(
  overrides: FeatureFlagOverrideConfig,
): FeatureFlagOverrideConfig {
  return Object.entries(overrides).reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[key as FeatureFlag] = value;
    } else if (value === 'true') {
      // Coagir string boolean — formato comum em configs externas/JSON
      acc[key as FeatureFlag] = true;
    } else if (value === 'false') {
      // Coagir string boolean — formato comum em configs externas/JSON
      acc[key as FeatureFlag] = false;
    } else {
      console.warn(
        `[FeatureFlags] Valor inesperado para flag "${key}": ${JSON.stringify(value)}. Esperado boolean ou string "true"/"false". Entrada ignorada.`
      );
    }
    return acc;
  }, {} as FeatureFlagOverrideConfig);
}

/**
 * Carrega flags personalizados a partir de environment ou JSON.
 * @example
 * loadFeatureFlags({
 *   [FeatureFlag.BT_TOPOLOGY_EDITOR]: false,
 *   [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: true,
 * })
 */
export function loadFeatureFlags(customFlags: Partial<Record<FeatureFlag, boolean>>): void {
  if (IS_PRODUCTION && Object.keys(customFlags).length > 0) {
    console.warn(
      'Feature flags customizadas não devem ser alteradas em produção. Use env vars.'
    );
    return;
  }
  
  const sanitizedCustomFlags = Object.entries(customFlags).reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[key as FeatureFlag] = value;
    }
    return acc;
  }, {} as Partial<Record<FeatureFlag, boolean>>);

  runtimeFlags = { ...runtimeFlags, ...sanitizedCustomFlags };
}

/**
 * Carrega regras de segmentação de feature flags por grupo de usuário e região.
 * Útil para rollout progressivo em grupos e regionais específicas.
 *
 * Pode ser chamado em qualquer ambiente — inclusive produção — pois recebe dados
 * de fonte externa (config server, env, arquivo) sem alterar os flags globais.
 * Prioridade de resolução ao avaliar: global → grupo → região.
 */
export function loadFeatureFlagTargeting(
  targeting: FeatureFlagTargetingConfig,
): void {
  const sanitizedUserGroups = Object.entries(targeting.userGroups ?? {}).reduce(
    (acc, [group, overrides]) => {
      const normalizedGroup = normalizeContextKey(group);
      if (!normalizedGroup) {
        return acc;
      }
      acc[normalizedGroup] = sanitizeOverrideConfig(overrides);
      return acc;
    },
    {} as Record<string, FeatureFlagOverrideConfig>
  );

  const sanitizedRegions = Object.entries(targeting.regions ?? {}).reduce(
    (acc, [region, overrides]) => {
      const normalizedRegion = normalizeContextKey(region);
      if (!normalizedRegion) {
        return acc;
      }
      acc[normalizedRegion] = sanitizeOverrideConfig(overrides);
      return acc;
    },
    {} as Record<string, FeatureFlagOverrideConfig>
  );

  runtimeTargeting = {
    userGroups: sanitizedUserGroups,
    regions: sanitizedRegions,
  };
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
 * Verifica feature flag considerando segmentação por grupo e região.
 * Prioridade de resolução: global → grupo → região.
 */
export function isFeatureEnabledForContext(
  flag: FeatureFlag,
  context?: FeatureFlagContext,
): boolean {
  let enabled = isFeatureEnabled(flag);

  if (context?.userGroup) {
    const groupOverride =
      runtimeTargeting.userGroups[normalizeContextKey(context.userGroup)]?.[flag];
    if (typeof groupOverride === 'boolean') {
      enabled = groupOverride;
    }
  }

  if (context?.region) {
    const regionOverride =
      runtimeTargeting.regions[normalizeContextKey(context.region)]?.[flag];
    if (typeof regionOverride === 'boolean') {
      enabled = regionOverride;
    }
  }

  return enabled;
}

/**
 * Retorna todos os flags (somente leitura em produção).
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

  runtimeTargeting = {
    userGroups: {},
    regions: {},
  };
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
