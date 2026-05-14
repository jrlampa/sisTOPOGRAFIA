import { renderHook, act } from '@testing-library/react';
import { useOsmEngine } from '@/hooks/useOsmEngine';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as osmService from '@/services/osmService';
import * as elevationService from '@/services/elevationService';
import * as geminiService from '@/services/geminiService';

vi.mock('@/services/osmService');
vi.mock('@/services/elevationService');
vi.mock('@/services/geminiService');

describe('useOsmEngine hook', () => {
  const mockCenter = { lat: -23.5505, lng: -46.6333, label: 'São Paulo' };
  const mockRadius = 500;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useOsmEngine());
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progressValue).toBe(0);
    expect(result.current.osmData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('runs analysis successfully', async () => {
    const mockOsmElements = [{ type: 'node', id: 1, lat: 1, lon: 1 }];
    const mockOsmStats = { 
      totalBuildings: 10, totalRoads: 5, totalNature: 2, 
      avgHeight: 15, maxHeight: 30, density: 'Média' as const, densityValue: 0.5 
    };
    const mockTerrain = [[{ lat: 1, lng: 1, elevation: 100 }]];
    const mockAiText = "Analysis summary";

    vi.mocked(osmService.fetchOsmData).mockResolvedValue({ 
      elements: mockOsmElements as any, 
      stats: mockOsmStats 
    });
    vi.mocked(elevationService.fetchElevationGrid).mockResolvedValue(mockTerrain as any);
    vi.mocked(geminiService.analyzeArea).mockResolvedValue(mockAiText);

    const { result } = renderHook(() => useOsmEngine());

    let analysisResult;
    await act(async () => {
      analysisResult = await result.current.runAnalysis(mockCenter, mockRadius, true);
    });

    expect(analysisResult).toEqual({ success: true });
    expect(result.current.osmData).toEqual(mockOsmElements);
    expect(result.current.terrainData).toEqual(mockTerrain);
    expect(result.current.stats?.totalBuildings).toBe(10);
    expect(result.current.analysisText).toBe(mockAiText);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progressValue).toBe(100);
  });

  it('handles error when no OSM data is found', async () => {
    vi.mocked(osmService.fetchOsmData).mockResolvedValue({ elements: [], stats: null });

    const { result } = renderHook(() => useOsmEngine());

    let analysisResult: any;
    await act(async () => {
      analysisResult = await result.current.runAnalysis(mockCenter, mockRadius, false);
    });

    expect(analysisResult.success).toBe(false);
    expect(analysisResult.errorMessage).toBe("Nenhum dado geográfico encontrado neste raio.");
    expect(result.current.error).toBe("Nenhum dado geográfico encontrado neste raio.");
    expect(result.current.isProcessing).toBe(false);
  });

  it('handles service errors', async () => {
    vi.mocked(osmService.fetchOsmData).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useOsmEngine());

    let analysisResult: any;
    await act(async () => {
      analysisResult = await result.current.runAnalysis(mockCenter, mockRadius, false);
    });

    expect(analysisResult.success).toBe(false);
    expect(result.current.error).toBe("Network error");
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progressValue).toBe(0);
  });

  it('clears data correctly', async () => {
    const { result } = renderHook(() => useOsmEngine());
    
    // Set some data manually for testing clearData
    act(() => {
        result.current.setOsmData([{ id: 1 } as any]);
    });
    expect(result.current.osmData).not.toBeNull();

    act(() => {
      result.current.clearData();
    });

    expect(result.current.osmData).toBeNull();
    expect(result.current.terrainData).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(result.current.analysisText).toBe("");
  });
});
