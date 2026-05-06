import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FeatureFlag,
  isFeatureEnabled,
  loadFeatureFlags,
  resetFeatureFlags,
} from '../src/config/featureFlags';

describe('Feature Flags overrides', () => {
  beforeEach(() => {
    resetFeatureFlags();
    vi.restoreAllMocks();
  });

  it('applies valid boolean override', () => {
    loadFeatureFlags({ [FeatureFlag.BT_TOPOLOGY_EDITOR]: false });

    expect(isFeatureEnabled(FeatureFlag.BT_TOPOLOGY_EDITOR)).toBe(false);
  });

  it('coerces valid boolean string override', () => {
    loadFeatureFlags({ [FeatureFlag.KML_IMPORT]: 'false' });

    expect(isFeatureEnabled(FeatureFlag.KML_IMPORT)).toBe(false);
  });

  it('ignora chave inválida e registra aviso', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Typo intentional: validates that unknown override keys are rejected.
    loadFeatureFlags({ BT_TOPOLOGY_EDTOR: false });

    expect(isFeatureEnabled(FeatureFlag.BT_TOPOLOGY_EDITOR)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      '[FeatureFlags] Chave de override desconhecida ignorada: BT_TOPOLOGY_EDTOR',
    );
  });

  it('ignora valor inválido e registra aviso', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadFeatureFlags({ [FeatureFlag.CQT_ANALYSIS]: 'invalid' });

    expect(isFeatureEnabled(FeatureFlag.CQT_ANALYSIS)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      '[FeatureFlags] Valor inválido para override "cqt_analysis". Esperado boolean, recebido string.',
    );
  });
});
