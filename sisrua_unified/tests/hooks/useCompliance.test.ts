import { renderHook, act } from '@testing-library/react';
import { useCompliance } from '@/hooks/useCompliance';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

// Mock dependencies
vi.mock('@/contexts/FeatureFlagContext');

describe('useCompliance hook', () => {
  const mockTopology = { poles: [], transformers: [], edges: [] } as any;
  const mockOsmData = [] as any[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(useFeatureFlags).mockReturnValue({
        flags: {
            enableNbr9050: true,
            enableEnvironmentalAudit: true,
            enableSolarShading: true,
        }
    } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs all enabled compliance checks', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' })
    } as any);

    const { result } = renderHook(() => useCompliance());

    await act(async () => {
      await result.current.runAnalysis(mockTopology, mockOsmData);
    });

    expect(fetch).toHaveBeenCalledTimes(5); // NBR, Env, Solar, Veg, Land
    expect(result.current.result?.urban).toEqual({ status: 'ok' });
    expect(result.current.loading).toBe(false);
  });

  it('skips disabled checks', async () => {
    vi.mocked(useFeatureFlags).mockReturnValue({
        flags: {
            enableNbr9050: false,
            enableEnvironmentalAudit: false,
            enableSolarShading: false,
        }
    } as any);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' })
    } as any);

    const { result } = renderHook(() => useCompliance());

    await act(async () => {
      await result.current.runAnalysis(mockTopology, mockOsmData);
    });

    expect(fetch).toHaveBeenCalledTimes(1); // Only Land (always enabled in code)
    expect(result.current.result?.urban).toBeNull();
  });

  it('handles fetch errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useCompliance());

    await act(async () => {
      await result.current.runAnalysis(mockTopology, mockOsmData);
    });

    expect(result.current.error).toBe('API failure');
    expect(result.current.loading).toBe(false);
  });
});
