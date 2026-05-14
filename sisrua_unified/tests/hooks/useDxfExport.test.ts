import { renderHook, act } from '@testing-library/react';
import { useDxfExport } from '@/hooks/useDxfExport';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dxfService from '@/services/dxfService';

vi.mock('@/services/dxfService');

describe('useDxfExport hook', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();
  
  const mockInputs = {
    center: { lat: 0, lng: 0 },
    radius: 100,
    selectionMode: 'circle' as const,
    polygon: [],
    layers: { buildings: true, roads: true } as any,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Mock window.location.assign
    vi.stubGlobal('location', { assign: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('handles immediate download URL', async () => {
    vi.mocked(dxfService.generateDXF).mockResolvedValue({ 
      url: 'http://test.com/file.dxf', 
      btContextUrl: 'http://test.com/ctx.json' 
    } as any);

    const { result } = renderHook(() => useDxfExport({ 
      onSuccess: mockOnSuccess, 
      onError: mockOnError 
    }));

    await act(async () => {
      await result.current.downloadDxf(
        mockInputs.center,
        mockInputs.radius,
        mockInputs.selectionMode,
        mockInputs.polygon,
        mockInputs.layers
      );
    });

    expect(window.location.assign).toHaveBeenCalledWith('http://test.com/file.dxf');
    expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
    expect(result.current.isDownloading).toBe(false);
  });

  it('handles job-based generation with polling', async () => {
    vi.mocked(dxfService.generateDXF).mockResolvedValue({ jobId: 'job-123' } as any);
    vi.mocked(dxfService.getDxfJobStatus)
      .mockResolvedValueOnce({ status: 'processing', progress: 50 } as any)
      .mockResolvedValueOnce({ status: 'completed', result: { url: 'http://test.com/file.dxf' } } as any);

    const { result } = renderHook(() => useDxfExport({ 
      onSuccess: mockOnSuccess, 
      onError: mockOnError 
    }));

    await act(async () => {
      await result.current.downloadDxf(
        mockInputs.center,
        mockInputs.radius,
        mockInputs.selectionMode,
        mockInputs.polygon,
        mockInputs.layers
      );
    });

    expect(result.current.jobId).toBe('job-123');
    expect(result.current.jobStatus).toBe('queued');

    // First poll
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.jobStatus).toBe('processing');
    expect(result.current.jobProgress).toBe(50);

    // Second poll (completed)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.jobStatus).toBe('completed');
    expect(window.location.assign).toHaveBeenCalledWith('http://test.com/file.dxf');
    expect(mockOnSuccess).toHaveBeenCalledWith('DXF Downloaded');
  });

  it('handles job failure', async () => {
    vi.mocked(dxfService.generateDXF).mockResolvedValue({ jobId: 'job-err' } as any);
    vi.mocked(dxfService.getDxfJobStatus).mockResolvedValue({ status: 'failed', error: 'Server crash' } as any);

    const { result } = renderHook(() => useDxfExport({ 
      onSuccess: mockOnSuccess, 
      onError: mockOnError 
    }));

    await act(async () => {
      await result.current.downloadDxf(
        mockInputs.center,
        mockInputs.radius,
        mockInputs.selectionMode,
        mockInputs.polygon,
        mockInputs.layers
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.jobStatus).toBe('failed');
    expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Server crash'));
  });
});
