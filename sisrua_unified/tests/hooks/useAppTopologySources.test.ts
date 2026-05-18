import { renderHook } from '@testing-library/react';
import { useAppTopologySources } from '@/hooks/useAppTopologySources';
import { describe, it, expect, vi } from 'vitest';
import * as mtBridge from '@/utils/mtTopologyBridge';
import * as renderSources from '@/utils/selectMapTopologyRenderSources';

// Mock utilities
vi.mock('@/utils/mtTopologyBridge');
vi.mock('@/utils/selectMapTopologyRenderSources');

describe('useAppTopologySources hook', () => {
  const mockAppState = {
    mtTopology: { poles: [], edges: [] },
    canonicalTopology: null,
  };

  const mockBtTopology = {
    poles: [{ id: 'p1', title: 'P1' }],
    transformers: [{ id: 't1' }],
    edges: [{ id: 'e1' }],
  };

  it('merges MT topology and selects render sources', () => {
    const mockMtMerged = { poles: [{ id: 'mt1' }], edges: [] };
    const mockRenderSources = {
        btMarkerTopology: { 
            poles: [{ id: 'p1', lat: 10, lng: 20 }], 
            transformers: [], 
            edges: [] 
        }
    };

    vi.mocked(mtBridge.mergeMtTopologyWithBtPoles).mockReturnValue(mockMtMerged as any);
    vi.mocked(renderSources.selectMapTopologyRenderSources).mockReturnValue(mockRenderSources as any);

    const { result } = renderHook(() => useAppTopologySources({ 
        appState: mockAppState, 
        btTopology: mockBtTopology 
    }));

    expect(mtBridge.mergeMtTopologyWithBtPoles).toHaveBeenCalledWith(mockBtTopology, mockAppState.mtTopology);
    expect(renderSources.selectMapTopologyRenderSources).toHaveBeenCalled();
    
    expect(result.current.mtTopology).toEqual(mockMtMerged);
    expect(result.current.mapRenderSources).toEqual(mockRenderSources);
  });

  it('generates dgTopologySource correctly by merging marker and original data', () => {
    const mockRenderSources = {
        btMarkerTopology: { 
            poles: [{ id: 'p1', lat: 10, lng: 20 }], 
            transformers: [{ id: 't1', lat: 10, lng: 20 }], 
            edges: [{ id: 'e1', fromPoleId: 'p1', toPoleId: 'p2' }] 
        }
    };

    vi.mocked(renderSources.selectMapTopologyRenderSources).mockReturnValue(mockRenderSources as any);

    const { result } = renderHook(() => useAppTopologySources({ 
        appState: mockAppState, 
        btTopology: mockBtTopology 
    }));

    const dgSource = result.current.dgTopologySource;
    
    // Verify pole merge
    expect(dgSource.poles[0].id).toBe('p1');
    expect(dgSource.poles[0].lat).toBe(10);
    expect(dgSource.poles[0].title).toBe('P1'); // Preserved from original
    
    // Verify transformer merge
    expect(dgSource.transformers[0].id).toBe('t1');
    
    // Verify edge merge
    expect(dgSource.edges[0].id).toBe('e1');
  });
});
