import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBtNavigationState } from '../src/hooks/useBtNavigationState';
import type { BtTopology } from '../src/types';
import * as btCalculations from '../src/utils/btCalculations';
import * as btNormalization from '../src/utils/btNormalization';

// Mock utilities
vi.mock('../src/utils/btCalculations');
vi.mock('../src/utils/btNormalization');

const createTopology = (): BtTopology => ({
  poles: [
    { id: 'P1', lat: -22.825546, lng: -43.325956, title: 'Poste 1' },
    { id: 'P2', lat: -22.825646, lng: -43.325856, title: 'Poste 2' },
  ],
  transformers: [
    { id: 'T1', poleId: 'P1', lat: -22.825546, lng: -43.325956, title: 'Trafo 1', monthlyBillBrl: 0, demandKw: 0, readings: [] },
    { id: 'T2', poleId: 'P2', lat: -22.825646, lng: -43.325856, title: 'Trafo 2', monthlyBillBrl: 0, demandKw: 0, readings: [] },
  ],
  edges: [
    { id: 'E1', fromPoleId: 'P1', toPoleId: 'P2', conductors: [] },
  ],
});

describe('useBtNavigationState hook', () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(btCalculations.findTransformerConflictsWithoutSectioning).mockReturnValue([]);
  });

  it('gera fly-to do poste e do transformador selecionados', () => {
    const { result } = renderHook(() => useBtNavigationState({ btTopology: createTopology(), showToast: mockShowToast }));

    act(() => {
      result.current.handleBtSelectedPoleChange('P2');
      result.current.handleBtSelectedTransformerChange('T2');
    });

    expect(result.current.btPoleFlyToTarget).toMatchObject({ lat: -22.825646, lng: -43.325856 });
    expect(result.current.btTransformerFlyToTarget).toMatchObject({ lat: -22.825646, lng: -43.325856 });
  });

  it('gera fly-to do trecho a partir do ponto médio dos postes', () => {
    const { result } = renderHook(() => useBtNavigationState({ btTopology: createTopology(), showToast: mockShowToast }));

    act(() => {
      result.current.handleBtSelectedEdgeChange('E1');
    });

    expect(result.current.btEdgeFlyToTarget).toMatchObject({
      lat: (-22.825546 + -22.825646) / 2,
      lng: (-43.325956 + -43.325856) / 2,
    });
  });

  it('dispara alerta apenas uma vez para a mesma assinatura de conflito', () => {
    vi.mocked(btCalculations.findTransformerConflictsWithoutSectioning).mockReturnValue([
        { transformerIds: ['T1', 'T2'] }
    ] as any);

    const { rerender } = renderHook(
      ({ btTopology }) => useBtNavigationState({ btTopology, showToast: mockShowToast }),
      { initialProps: { btTopology: createTopology() } }
    );

    expect(mockShowToast).toHaveBeenCalledTimes(1);

    rerender({ btTopology: createTopology() });
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  it('handles shift selection (multiple poles)', () => {
    const { result } = renderHook(() => useBtNavigationState({ 
      btTopology: createTopology(), 
      showToast: mockShowToast 
    }));

    act(() => {
      result.current.handleBtSelectedPoleChange('P1');
    });
    
    act(() => {
      result.current.handleBtSelectedPoleChange('P2', true); // Shift select
    });

    expect(result.current.selectedPoleIds).toEqual(['P1', 'P2']);
    expect(result.current.selectedPoleId).toBe(""); // Cleared because multiple selected

    // Toggle off p1
    act(() => {
        result.current.handleBtSelectedPoleChange('P1', true);
    });
    expect(result.current.selectedPoleIds).toEqual(['P2']);
    expect(result.current.selectedPoleId).toBe('P2');
  });

  it('selects all poles in polygon', () => {
    vi.mocked(btNormalization.isPointInPolygon).mockReturnValue(true);
    
    const { result } = renderHook(() => useBtNavigationState({ 
      btTopology: createTopology(), 
      showToast: mockShowToast 
    }));

    act(() => {
      result.current.handleSelectAllInPolygon([{ lat: 0, lng: 0 }, { lat: 2, lng: 2 }]);
    });

    expect(result.current.selectedPoleIds).toHaveLength(2);
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('2 ativos selecionados'), 'info');
  });

  it('ignores selection of non-existent items', () => {
    const { result } = renderHook(() => useBtNavigationState({ 
      btTopology: createTopology(), 
      showToast: mockShowToast 
    }));

    act(() => {
      result.current.handleBtSelectedPoleChange('ghost');
    });
    expect(result.current.selectedPoleId).toBe("");

    act(() => {
        result.current.handleBtSelectedEdgeChange('ghost');
    });
    expect(result.current.selectedEdgeId).toBe("");
  });
});
