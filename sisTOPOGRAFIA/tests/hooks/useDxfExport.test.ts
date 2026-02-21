import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../src/services/dxfService', () => ({
  generateDXF: vi.fn(),
  getDxfJobStatus: vi.fn()
}));

import { useDxfExport } from '../../src/hooks/useDxfExport';
import { generateDXF, getDxfJobStatus } from '../../src/services/dxfService';
import Logger from '../../src/utils/logger';

const center = { lat: -22.15018, lng: -42.92185, label: 'Nova Friburgo' };
const radius = 500;
const layers = { buildings: true, roads: true };

describe('useDxfExport', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inicializa com estado correto', () => {
    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.jobId).toBeNull();
    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.jobProgress).toBe(0);
    expect(result.current.heatmapData).toBeNull();
    expect(result.current.aiSuggestion).toBeNull();
    expect(result.current.economicData).toBeNull();
    expect(result.current.longitudinalProfile).toBeNull();
  });

  // ── downloadDxf — cached response ───────────────────────────────────────

  it('downloadDxf aciona download imediato quando resultado tem URL (cached)', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'success', url: '/downloads/test.dxf' });

    const anchorClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = anchorClickSpy;
      }
      return el;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(success).toBe(true);
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.jobStatus).toBe('completed');

    createElementSpy.mockRestore();
  });

  // ── downloadDxf — queued response ───────────────────────────────────────

  it('downloadDxf define jobId quando resultado é queued', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-abc' });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(success).toBe(true);
    expect(result.current.jobId).toBe('job-abc');
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  // ── downloadDxf — error response ────────────────────────────────────────

  it('downloadDxf chama onError quando generateDXF lança exceção', async () => {
    (generateDXF as any).mockRejectedValueOnce(new Error('Backend failed'));

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(success).toBe(false);
    expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Backend failed'));
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.jobStatus).toBe('failed');
  });

  it('downloadDxf chama onError quando resultado é null/falsy', async () => {
    (generateDXF as any).mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(success).toBe(false);
    expect(result.current.jobStatus).toBe('failed');
  });

  it('downloadDxf usa mensagem fallback quando erro não é Error', async () => {
    (generateDXF as any).mockRejectedValueOnce('string error');

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('DXF generation failed'));
  });

  // ── useEffect polling — completed ────────────────────────────────────────

  it('polling detecta job completed e aciona download', async () => {
    // 1. Queue the job
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-xyz' });

    // 2. completed status on first poll
    (getDxfJobStatus as any).mockResolvedValueOnce({
      status: 'completed',
      progress: 100,
      result: { url: '/downloads/job-xyz.dxf' },
      error: null
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as any;

    const anchorClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = anchorClickSpy; }
      return el;
    });

    // Intercept setInterval to capture and invoke callback manually
    let capturedCallback: (() => void) | null = null;
    const origSetInterval = window.setInterval;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any, _delay?: any) => {
      capturedCallback = cb;
      return 99 as any; // fake handle
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    // Download → queue the job → useEffect registers interval
    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(result.current.jobId).toBe('job-xyz');
    expect(capturedCallback).not.toBeNull();

    // Manually invoke the interval callback (simulates 2s poll)
    await act(async () => {
      await capturedCallback!();
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
    });

    expect(anchorClickSpy).toHaveBeenCalled();
    expect(result.current.jobId).toBeNull();

    createElementSpy.mockRestore();
    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── useEffect polling — failed ───────────────────────────────────────────

  it('polling detecta job failed e chama onError', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-fail' });
    (getDxfJobStatus as any).mockResolvedValueOnce({
      status: 'failed',
      progress: 0,
      result: null,
      error: 'Python engine crashed'
    });

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 100 as any;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    await act(async () => {
      await capturedCallback!();
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Python engine crashed'));
    });

    expect(result.current.jobId).toBeNull();
    expect(result.current.jobStatus).toBe('failed');

    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── useEffect polling — getDxfJobStatus throws ───────────────────────────

  it('polling chama onError quando getDxfJobStatus lança exceção', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-err' });
    (getDxfJobStatus as any).mockRejectedValueOnce(new Error('Status fetch failed'));

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 101 as any;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    await act(async () => {
      await capturedCallback!();
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Status fetch failed'));
    });

    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── polling — completed com assets (heatmap/AI/econ/csv/pdf) sucesso ─────

  it('polling carrega assets suplementares quando completed e fetch retorna ok', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-assets' });
    (getDxfJobStatus as any).mockResolvedValueOnce({
      status: 'completed',
      progress: 100,
      result: { url: '/downloads/job-assets.dxf' },
      error: null
    });

    // Mock supplementary fetches: heatmap, AI, econ, csv (2 calls: blob+text), pdf
    const mockBlob = new Blob(['data'], { type: 'application/octet-stream' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ cells: [1, 2, 3] }) })
      .mockResolvedValueOnce({ ok: true, text: async () => '# AI Design suggestion' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCost: 99000 }) })
      .mockResolvedValueOnce({
        ok: true,
        clone: () => ({ blob: async () => mockBlob }),
        text: async () => 'elevation\n850\n855\n860'
      })
      .mockResolvedValueOnce({ ok: true, blob: async () => mockBlob });
    global.fetch = fetchMock as any;

    const anchorClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = anchorClickSpy; }
      return el;
    });

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 102 as any;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    await act(async () => { await capturedCallback!(); });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
    });

    // Heatmap should be set
    expect(result.current.heatmapData).toEqual({ cells: [1, 2, 3] });
    // AI suggestion should be set
    expect(result.current.aiSuggestion).toBe('# AI Design suggestion');
    // Economic data should be set
    expect(result.current.economicData).toEqual({ totalCost: 99000 });
    // Profile should be parsed from CSV (3 data lines)
    expect(result.current.longitudinalProfile).toHaveLength(3);

    createElementSpy.mockRestore();
    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── polling — completed sem URL → throw ──────────────────────────────────

  it('polling chama onError quando job completed não tem URL', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-nourl' });
    (getDxfJobStatus as any).mockResolvedValueOnce({
      status: 'completed',
      progress: 100,
      result: null, // no URL
      error: null
    });

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 103 as any;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    await act(async () => { await capturedCallback!(); });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('DXF job completed without a URL')
      );
    });

    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── setters for derived state ────────────────────────────────────────────

  it('setHeatmapData, setAiSuggestion, setEconomicData, setLongitudinalProfile funcionam', () => {
    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    act(() => { result.current.setHeatmapData({ cells: [] }); });
    expect(result.current.heatmapData).toEqual({ cells: [] });

    act(() => { result.current.setAiSuggestion('# Sugestão'); });
    expect(result.current.aiSuggestion).toBe('# Sugestão');

    act(() => { result.current.setEconomicData({ totalCost: 50000 }); });
    expect(result.current.economicData).toEqual({ totalCost: 50000 });

    act(() => { result.current.setLongitudinalProfile([{ distance: 0, elevation: 850 }]); });
    expect(result.current.longitudinalProfile).toEqual([{ distance: 0, elevation: 850 }]);
  });

  // ── polling — PDF fetch throws → Logger.error (linhas 183-185) ──────────

  it('polling registra erro quando fetch do PDF lança exceção (linhas 183-185)', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-pdferr' });
    (getDxfJobStatus as any).mockResolvedValueOnce({
      status: 'completed',
      progress: 100,
      result: { url: '/downloads/job-pdferr.dxf' },
      error: null
    });

    const pdfError = new Error('PDF fetch failed');
    // Heatmap, AI, econ succeed; CSV ok; PDF throws
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        clone: () => ({ blob: async () => new Blob() }),
        text: async () => 'elevation\n850'
      })
      .mockRejectedValueOnce(pdfError);          // PDF fetch throws
    global.fetch = fetchMock as any;

    const anchorClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = anchorClickSpy; }
      return el;
    });

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 120 as any;
    });

    const { result } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    await act(async () => { await capturedCallback!(); });

    await waitFor(() => {
      // PDF error is caught and logged but does NOT prevent success
      expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
    });

    expect(Logger.error).toHaveBeenCalledWith('Failed to download PDF report', pdfError);

    createElementSpy.mockRestore();
    vi.spyOn(window, 'setInterval').mockRestore();
  });

  // ── polling — !isActive guard: unmount before catch fires (linhas 207-209) ─

  it('polling não chama onError quando componente desmontado antes do catch (linhas 207-209)', async () => {
    (generateDXF as any).mockResolvedValueOnce({ status: 'queued', jobId: 'job-inactive' });
    // getDxfJobStatus rejects to trigger the catch block
    (getDxfJobStatus as any).mockRejectedValue(new Error('Timeout'));

    let capturedCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return 121 as any;
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => {});

    const { result, unmount } = renderHook(() =>
      useDxfExport({ onSuccess: mockOnSuccess, onError: mockOnError })
    );

    await act(async () => {
      await result.current.downloadDxf(center, radius, 'circle', [], layers as any);
    });

    expect(capturedCallback).not.toBeNull();

    // Unmount → cleanup sets isActive = false
    unmount();

    // Call interval callback after unmount → getDxfJobStatus throws, catch fires with !isActive
    await act(async () => { await capturedCallback!(); });

    // onError must NOT have been called because isActive = false → early return
    expect(mockOnError).not.toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    vi.spyOn(window, 'setInterval').mockRestore();
  });
});

