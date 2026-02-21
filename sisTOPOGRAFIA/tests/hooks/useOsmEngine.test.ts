import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock all external service dependencies
vi.mock('../../src/services/osmService', () => ({
  fetchOsmData: vi.fn()
}));
vi.mock('../../src/services/elevationService', () => ({
  fetchElevationGrid: vi.fn()
}));
vi.mock('../../src/services/dxfService', () => ({
  calculateStats: vi.fn()
}));
vi.mock('../../src/services/geminiService', () => ({
  analyzeArea: vi.fn()
}));

import { useOsmEngine } from '../../src/hooks/useOsmEngine';
import { fetchOsmData } from '../../src/services/osmService';
import { fetchElevationGrid } from '../../src/services/elevationService';
import { calculateStats } from '../../src/services/dxfService';
import { analyzeArea } from '../../src/services/geminiService';

const center = { lat: -22.15018, lng: -42.92185, label: 'Nova Friburgo' };
const radius = 500;

const mockOsmElements = [
  { type: 'node' as const, id: 1, lat: -22.15, lon: -42.92, tags: { building: 'yes' } }
];

const mockTerrain = {
  grid: [[100, 110], [105, 115]],
  minElevation: 100,
  maxElevation: 115,
  bounds: { north: -22.14, south: -22.16, east: -42.91, west: -42.93 }
};

const mockStats = {
  totalBuildings: 1, totalRoads: 0, totalNature: 0,
  avgHeight: 0, maxHeight: 0, avgSlope: 8.4, avgSolar: 0.72,
  maxFlow: 0, cutVolume: 0, fillVolume: 0
};

describe('useOsmEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa com estado limpo', () => {
    const { result } = renderHook(() => useOsmEngine());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progressValue).toBe(0);
    expect(result.current.osmData).toBeNull();
    expect(result.current.terrainData).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(result.current.analysisText).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('runAnalysis executa pipeline completo com AI ativada', async () => {
    (fetchOsmData as any).mockResolvedValueOnce(mockOsmElements);
    (fetchElevationGrid as any).mockResolvedValueOnce(mockTerrain);
    (calculateStats as any).mockReturnValueOnce(mockStats);
    (analyzeArea as any).mockResolvedValueOnce('Área com alta densidade urbana.');

    const { result } = renderHook(() => useOsmEngine());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.runAnalysis(center, radius, true);
    });

    expect(success).toBe(true);

    await waitFor(() => {
      expect(result.current.osmData).toEqual(mockOsmElements);
      expect(result.current.terrainData).toEqual(mockTerrain);
      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.analysisText).toBe('Área com alta densidade urbana.');
      expect(result.current.error).toBeNull();
    });

    expect(fetchOsmData).toHaveBeenCalledWith(center.lat, center.lng, radius);
    expect(fetchElevationGrid).toHaveBeenCalledWith(center, radius);
    expect(calculateStats).toHaveBeenCalledWith(mockOsmElements);
    expect(analyzeArea).toHaveBeenCalledWith(mockStats, center.label, true);
  });

  it('runAnalysis com AI desabilitada define texto padrão sem chamar analyzeArea', async () => {
    (fetchOsmData as any).mockResolvedValueOnce(mockOsmElements);
    (fetchElevationGrid as any).mockResolvedValueOnce(mockTerrain);
    (calculateStats as any).mockReturnValueOnce(mockStats);

    const { result } = renderHook(() => useOsmEngine());

    await act(async () => {
      await result.current.runAnalysis(center, radius, false);
    });

    await waitFor(() => {
      expect(result.current.analysisText).toBe('Analysis summary disabled.');
    });
    expect(analyzeArea).not.toHaveBeenCalled();
  });

  it('runAnalysis lança erro quando nenhum elemento OSM encontrado', async () => {
    (fetchOsmData as any).mockResolvedValueOnce([]); // empty array

    const { result } = renderHook(() => useOsmEngine());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.runAnalysis(center, radius, true);
    });

    expect(success).toBe(false);

    await waitFor(() => {
      expect(result.current.error).toContain('No architectural data found');
    });
  });

  it('runAnalysis captura erro de rede do fetchOsmData', async () => {
    (fetchOsmData as any).mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useOsmEngine());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.runAnalysis(center, radius, true);
    });

    expect(success).toBe(false);

    await waitFor(() => {
      expect(result.current.error).toBe('Network failure');
    });
  });

  it('runAnalysis captura erro de rede do fetchElevationGrid', async () => {
    (fetchOsmData as any).mockResolvedValueOnce(mockOsmElements);
    (fetchElevationGrid as any).mockRejectedValueOnce(new Error('Elevation API error'));
    (calculateStats as any).mockReturnValueOnce(mockStats);

    const { result } = renderHook(() => useOsmEngine());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.runAnalysis(center, radius, true);
    });

    expect(success).toBe(false);

    await waitFor(() => {
      expect(result.current.error).toBe('Elevation API error');
    });
  });

  it('clearData reseta todos os estados', async () => {
    (fetchOsmData as any).mockResolvedValueOnce(mockOsmElements);
    (fetchElevationGrid as any).mockResolvedValueOnce(mockTerrain);
    (calculateStats as any).mockReturnValueOnce(mockStats);
    (analyzeArea as any).mockResolvedValueOnce('Texto de análise');

    const { result } = renderHook(() => useOsmEngine());

    await act(async () => {
      await result.current.runAnalysis(center, radius, true);
    });

    await waitFor(() => {
      expect(result.current.osmData).not.toBeNull();
    });

    act(() => { result.current.clearData(); });

    expect(result.current.osmData).toBeNull();
    expect(result.current.terrainData).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(result.current.analysisText).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('setOsmData permite injetar dados OSM diretamente', () => {
    const { result } = renderHook(() => useOsmEngine());

    act(() => { result.current.setOsmData(mockOsmElements); });

    expect(result.current.osmData).toEqual(mockOsmElements);
  });

  it('runAnalysis usa mensagem fallback quando erro não tem .message', async () => {
    (fetchOsmData as any).mockRejectedValueOnce('string error value');

    const { result } = renderHook(() => useOsmEngine());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.runAnalysis(center, radius, true);
    });

    expect(success).toBe(false);

    await waitFor(() => {
      expect(result.current.error).toBe('Audit failed.');
    });
  });

  // ── setTimeout body (linhas 64-65) ──────────────────────────────────────

  it('runAnalysis reseta isProcessing e progressValue via setTimeout após 800ms (linhas 64-65)', async () => {
    vi.useFakeTimers();
    (fetchOsmData as any).mockRejectedValueOnce(new Error('Timeout'));

    const { result } = renderHook(() => useOsmEngine());

    // Start runAnalysis — it will throw, enter finally, and schedule setTimeout(800)
    await act(async () => {
      await result.current.runAnalysis(center, radius, true);
    });

    // Before timer fires, isProcessing should still be true (set at start of runAnalysis)
    expect(result.current.isProcessing).toBe(true);

    // Advance timers by 800ms to fire the setTimeout
    await act(async () => { vi.advanceTimersByTime(800); });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progressValue).toBe(0);

    vi.useRealTimers();
  });
});
