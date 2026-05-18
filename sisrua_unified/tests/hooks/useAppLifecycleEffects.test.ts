import { renderHook } from '@testing-library/react';
import { useAppLifecycleEffects } from '@/hooks/useAppLifecycleEffects';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as prefs from '@/utils/preferencesPersistence';

// Mock dependencies
vi.mock('@/utils/preferencesPersistence', () => ({
  persistAppSettings: vi.fn()
}));

describe('useAppLifecycleEffects hook', () => {
  const mockParams = {
    settings: { locale: 'pt-BR', theme: 'light' },
    isDark: false,
    btTopology: { poles: [], transformers: [], edges: [] },
    btSectioningImpact: { unservedPoleIds: [], unservedClients: 0 },
    showToast: vi.fn(),
    setAppState: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('persists settings on change', () => {
    const { rerender } = renderHook(
      (params) => useAppLifecycleEffects(params),
      { initialProps: mockParams }
    );

    expect(prefs.persistAppSettings).toHaveBeenCalledWith(mockParams.settings);

    const nextParams = { ...mockParams, settings: { ...mockParams.settings, theme: 'dark' } };
    rerender(nextParams);
    expect(prefs.persistAppSettings).toHaveBeenCalledWith(nextParams.settings);
  });

  it('syncs theme with document attributes', () => {
    const { rerender } = renderHook(
      (params) => useAppLifecycleEffects(params),
      { initialProps: mockParams }
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    rerender({ ...mockParams, isDark: true });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('shows toast when transformer removal causes unserved poles', () => {
    const topologyWithTrafo = {
        poles: [],
        transformers: [{ id: 't1' }],
        edges: []
    } as any;

    const { rerender } = renderHook(
      (params) => useAppLifecycleEffects(params),
      { initialProps: { ...mockParams, btTopology: topologyWithTrafo } }
    );

    // Simulate removal and impact
    const topologyEmpty = { poles: [], transformers: [], edges: [] } as any;
    const impact = { unservedPoleIds: ['p1'], unservedClients: 5 };

    rerender({ 
        ...mockParams, 
        btTopology: topologyEmpty, 
        btSectioningImpact: impact 
    });

    expect(mockParams.showToast).toHaveBeenCalledWith(
        expect.stringContaining('circuito sem transformador'),
        'error'
    );
  });
});
