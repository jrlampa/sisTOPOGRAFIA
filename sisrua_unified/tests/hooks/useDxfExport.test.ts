import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDxfExport } from '../../src/hooks/useDxfExport';
import type { GeoLocation, LayerConfig } from '../../src/types';

vi.mock('../../src/services/dxfService', () => ({
  generateDXF: vi.fn(),
  getDxfJobStatus: vi.fn(),
}));

import { generateDXF, getDxfJobStatus } from '../../src/services/dxfService';

const center: GeoLocation = { lat: -23.5505, lng: -46.6333, label: 'SP' };
const polygon: GeoLocation[] = [
  { lat: -23.5505, lng: -46.6333 },
  { lat: -23.551, lng: -46.634 },
  { lat: -23.5515, lng: -46.633 },
];
const layers: LayerConfig = { buildings: true, roads: true };

describe('useDxfExport critical flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ btContext: { network: 'ok' } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads immediately when backend returns URL', async () => {
    vi.mocked(generateDXF).mockResolvedValueOnce({
      url: 'http://localhost:3001/downloads/test.dxf',
      btContextUrl: 'http://localhost:3001/downloads/context.json',
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onBtContextLoaded = vi.fn();
    const click = vi.fn();

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
      if (tagName === 'a') {
        return { href: '', download: '', click } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess, onError, onBtContextLoaded })
    );

    await act(async () => {
      const ok = await result.current.downloadDxf(center, 500, 'polygon', polygon, layers);
      expect(ok).toBe(true);
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(onBtContextLoaded).toHaveBeenCalledWith({
      btContextUrl: 'http://localhost:3001/downloads/context.json',
      btContext: { network: 'ok' },
    });
  });

  it('polls queued job until completion and finalizes download', async () => {
    vi.mocked(generateDXF).mockResolvedValueOnce({ jobId: 'job-123' });
    vi.mocked(getDxfJobStatus).mockResolvedValueOnce({
      status: 'completed',
      progress: 100,
      result: {
        url: 'http://localhost:3001/downloads/job-123.dxf',
        btContextUrl: 'http://localhost:3001/downloads/context-job.json',
      },
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const click = vi.fn();

    vi.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler) => {
      void (callback as () => Promise<void>)();
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof window.setInterval);
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);

    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
      if (tagName === 'a') {
        return { href: '', download: '', click } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess, onError })
    );

    await act(async () => {
      const ok = await result.current.downloadDxf(center, 500, 'polygon', polygon, layers);
      expect(ok).toBe(true);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
    });
    expect(onError).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('returns false and emits error on invalid export input', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess, onError })
    );

    await act(async () => {
      const ok = await result.current.downloadDxf(center, 50, 'polygon', polygon, layers);
      expect(ok).toBe(false);
    });

    expect(generateDXF).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('DXF Error: Invalid input parameters');
  });
});
