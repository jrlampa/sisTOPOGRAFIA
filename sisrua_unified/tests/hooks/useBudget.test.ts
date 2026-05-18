import { renderHook, act } from '@testing-library/react';
import { useBudget } from '@/hooks/useBudget';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useBudget hook', () => {
  const mockTopology = { poles: [], transformers: [], edges: [] } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calculates full budget successfully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ custoDirectoTotal: 10000, items: [] }) } as any) // SINAPI
      .mockResolvedValueOnce({ ok: true, json: async () => ({ percentualBdi: 20, custoComBdi: 12000 }) } as any) // BDI
      .mockResolvedValueOnce({ ok: true, json: async () => ({ vpl: 5000, viavel: true }) } as any); // ROI

    const { result } = renderHook(() => useBudget());

    await act(async () => {
      await result.current.calculateBudget(mockTopology, 't1', 'p1');
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.result?.sinapi?.custoDirectoTotal).toBe(10000);
    expect(result.current.result?.roi?.viavel).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('handles error from sinapi service', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ erro: 'Invalid topology data' }) 
    } as any);

    const { result } = renderHook(() => useBudget());

    await act(async () => {
      await result.current.calculateBudget(mockTopology, 't1', 'p1');
    });

    expect(result.current.error).toBe('Invalid topology data');
    expect(result.current.loading).toBe(false);
  });

  it('handles network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() => useBudget());

    await act(async () => {
      await result.current.calculateBudget(mockTopology, 't1', 'p1');
    });

    expect(result.current.error).toBe('Network offline');
  });
});
