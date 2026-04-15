import { beforeEach, describe, expect, it } from 'vitest';
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

  it('preserva comportamento global sem contexto', () => {
    loadFeatureFlags({ [FeatureFlag.KML_IMPORT]: false });
    expect(isFeatureEnabled(FeatureFlag.KML_IMPORT)).toBe(false);
    expect(isFeatureEnabledForContext(FeatureFlag.KML_IMPORT)).toBe(false);
  });

  it('aplica override por grupo de usuário', () => {
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

  it('aplica override por região com precedência sobre grupo', () => {
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

  it('normaliza chaves de grupo e região', () => {
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
});
