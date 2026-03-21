import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEarthwork } from '../../src/hooks/useEarthwork';
import Logger from '../../src/utils/logger';

describe('useEarthwork', () => {
  const originalFetch = global.fetch;

  const polygon = [
    { lat: -22.15018, lng: -42.92185 },
    { lat: -22.16000, lng: -42.92185 },
    { lat: -22.16000, lng: -42.91000 },
    { lat: -22.15018, lng: -42.92185 }
  ];
  const targetZ = 850;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('inicializa com isCalculating=false', () => {
    const { result } = renderHook(() => useEarthwork());
    expect(result.current.isCalculating).toBe(false);
  });

  it('calculateEarthwork retorna dados quando servidor responde ok', async () => {
    const mockData = {
      cut_volume: 1200,
      fill_volume: 850,
      balance: 350,
      area: 5000
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    }) as any;

    const { result } = renderHook(() => useEarthwork());

    let data: any;
    await act(async () => {
      data = await result.current.calculateEarthwork(polygon, targetZ);
    });

    expect(data).toEqual(mockData);
    expect(result.current.isCalculating).toBe(false);

    // Verify FormData was sent with correct fields
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain('/api/analyze-pad');
    expect(call[1].method).toBe('POST');
    const formData = call[1].body as FormData;
    expect(formData.get('target_z')).toBe(String(targetZ));
    expect(JSON.parse(formData.get('polygon') as string)).toHaveLength(polygon.length);
  });

  it('calculateEarthwork lança erro quando servidor retorna HTTP não-ok', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Polígono inválido' })
    }) as any;

    const { result } = renderHook(() => useEarthwork());

    await act(async () => {
      await expect(result.current.calculateEarthwork(polygon, targetZ))
        .rejects.toThrow('Polígono inválido');
    });

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });
  });

  it('usa mensagem fallback quando erro HTTP não tem campo error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    }) as any;

    const { result } = renderHook(() => useEarthwork());

    await act(async () => {
      await expect(result.current.calculateEarthwork(polygon, targetZ))
        .rejects.toThrow('HTTP error! status: 500');
    });
  });

  it('calculateEarthwork lança erro quando fetch lança exceção (rede)', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error')) as any;

    const { result } = renderHook(() => useEarthwork());
    const consoleSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.calculateEarthwork(polygon, targetZ))
        .rejects.toThrow('Network error');
    });

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('define isCalculating=true durante o cálculo', async () => {
    let resolveResponse: (v: any) => void;
    const pendingPromise = new Promise(resolve => { resolveResponse = resolve; });

    global.fetch = vi.fn().mockReturnValueOnce(pendingPromise) as any;

    const { result } = renderHook(() => useEarthwork());

    let calcPromise: Promise<any>;
    act(() => {
      calcPromise = result.current.calculateEarthwork(polygon, targetZ);
    });

    // isCalculating should be true while fetch is pending
    expect(result.current.isCalculating).toBe(true);

    // Resolve and wait for completion
    await act(async () => {
      resolveResponse!({ ok: true, json: async () => ({ cut_volume: 0 }) });
      await calcPromise!;
    });

    expect(result.current.isCalculating).toBe(false);
  });
});
