import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FeatureFlag,
  isFeatureEnabled,
  isFeatureEnabledForContext,
  loadFeatureFlagTargeting,
  loadFeatureFlags,
  resetFeatureFlags,
} from '../../src/config/featureFlags';

describe('featureFlags targeting', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('preserves global behavior without context', () => {
    loadFeatureFlags({ [FeatureFlag.KML_IMPORT]: false });
    expect(isFeatureEnabled(FeatureFlag.KML_IMPORT)).toBe(false);
    expect(isFeatureEnabledForContext(FeatureFlag.KML_IMPORT)).toBe(false);
  });

  it('applies override by user group', () => {
    loadFeatureFlags({ [FeatureFlag.BT_TOPOLOGY_EDITOR]: false });
    loadFeatureFlagTargeting({
      userGroups: {
        engenharia: { [FeatureFlag.BT_TOPOLOGY_EDITOR]: true },
      },
    });

    expect(
      isFeatureEnabledForContext(FeatureFlag.BT_TOPOLOGY_EDITOR, {
        userGroup: 'engenharia',
      })
    ).toBe(true);
    expect(
      isFeatureEnabledForContext(FeatureFlag.BT_TOPOLOGY_EDITOR, {
        userGroup: 'viewer',
      })
    ).toBe(false);
  });

  it('applies override by region with precedence over user group', () => {
    loadFeatureFlags({ [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: false });
    loadFeatureFlagTargeting({
      userGroups: {
        operacao: { [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: true },
      },
      regions: {
        sudeste: { [FeatureFlag.AI_CLANDESTINO_ANALYSIS]: false },
      },
    });

    expect(
      isFeatureEnabledForContext(FeatureFlag.AI_CLANDESTINO_ANALYSIS, {
        userGroup: 'operacao',
      })
    ).toBe(true);
    expect(
      isFeatureEnabledForContext(FeatureFlag.AI_CLANDESTINO_ANALYSIS, {
        userGroup: 'operacao',
        region: 'sudeste',
      })
    ).toBe(false);
  });

  it('normalizes group and region keys', () => {
    loadFeatureFlags({ [FeatureFlag.MULTI_SCENARIO_SUPPORT]: false });
    loadFeatureFlagTargeting({
      userGroups: {
        '  Engenharia  ': { [FeatureFlag.MULTI_SCENARIO_SUPPORT]: true },
      },
      regions: {
        '  Sul  ': { [FeatureFlag.MULTI_SCENARIO_SUPPORT]: true },
      },
    });

    expect(
      isFeatureEnabledForContext(FeatureFlag.MULTI_SCENARIO_SUPPORT, {
        userGroup: 'engenharia',
      })
    ).toBe(true);
    expect(
      isFeatureEnabledForContext(FeatureFlag.MULTI_SCENARIO_SUPPORT, {
        region: 'SUL',
      })
    ).toBe(true);
  });

  it('loadFeatureFlagTargeting aplica targeting mesmo em produção (sem no-op silencioso)', () => {
    // Simula carga de config proveniente de fonte externa (servidor de config, env)
    // A função não deve ignorar os dados — targeting é configuração, não bypass de segurança.
    loadFeatureFlags({ [FeatureFlag.DXF_EXPORT]: false });
    loadFeatureFlagTargeting({
      userGroups: {
        admin: { [FeatureFlag.DXF_EXPORT]: true },
      },
    });

    expect(
      isFeatureEnabledForContext(FeatureFlag.DXF_EXPORT, { userGroup: 'admin' })
    ).toBe(true);
    expect(
      isFeatureEnabledForContext(FeatureFlag.DXF_EXPORT, { userGroup: 'guest' })
    ).toBe(false);
  });

  it('sanitizeOverrideConfig coage string "true"/"false" para boolean', () => {
    // Valores string são comuns em configs carregadas de JSON/env externo
    loadFeatureFlagTargeting({
      userGroups: {
        // Forçar via cast para testar coerção de string boolean em runtime
        beta: { [FeatureFlag.ELEVATION_PROFILE]: 'true' as unknown as boolean },
      },
    });

    expect(
      isFeatureEnabledForContext(FeatureFlag.ELEVATION_PROFILE, {
        userGroup: 'beta',
      })
    ).toBe(true);
  });

  it('sanitizeOverrideConfig emite aviso para tipos inesperados e não aplica o valor', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadFeatureFlagTargeting({
      userGroups: {
        invalido: {
          [FeatureFlag.CQT_ANALYSIS]: 42 as unknown as boolean,
        },
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FeatureFlags]')
    );
    // Flag não deve ser sobrescrito com valor inválido
    expect(
      isFeatureEnabledForContext(FeatureFlag.CQT_ANALYSIS, {
        userGroup: 'invalido',
      })
    ).toBe(isFeatureEnabled(FeatureFlag.CQT_ANALYSIS));

    warnSpy.mockRestore();
  });
});
