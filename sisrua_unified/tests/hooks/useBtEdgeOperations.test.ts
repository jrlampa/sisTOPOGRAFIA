import { renderHook, act } from '@testing-library/react';
import { useBtEdgeOperations } from '@/hooks/useBtEdgeOperations';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useBtEdgeOperations hook', () => {
  const mockAppState = {
    btTopology: {
      poles: [
        { id: 'P1', lat: 10, lng: 10, title: 'Pole 1' },
        { id: 'P2', lat: 11, lng: 11, title: 'Pole 2' }
      ],
      transformers: [],
      edges: []
    }
  } as any;

  const mockSetAppState = vi.fn();
  const mockShowToast = vi.fn();
  const mockFindNearestPole = vi.fn();
  const mockUndo = vi.fn();

  const mockParams = {
    appState: mockAppState,
    setAppState: mockSetAppState,
    showToast: mockShowToast,
    findNearestPole: mockFindNearestPole,
    undo: mockUndo
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles first click to start edge creation', () => {
    mockFindNearestPole.mockReturnValue(mockAppState.btTopology.poles[0]);
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: 10, lng: 10 });
    });

    expect(result.current.pendingBtEdgeStartPoleId).toBe('P1');
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Origem selecionada'), 'info');
  });

  it('handles second click to complete edge creation', () => {
    mockFindNearestPole.mockReturnValue(mockAppState.btTopology.poles[0]);
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    // First click (P1)
    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: 10, lng: 10 });
    });

    // Second click (P2)
    mockFindNearestPole.mockReturnValue(mockAppState.btTopology.poles[1]);
    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: 11, lng: 11 });
    });

    expect(mockSetAppState).toHaveBeenCalledWith(expect.any(Function), true);
    expect(result.current.pendingBtEdgeStartPoleId).toBe('P2'); // Updates origin to last pole
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Condutor E1 criado'), 'success', expect.anything());
  });

  it('fails to add edge if no pole is near', () => {
    mockFindNearestPole.mockReturnValue(null);
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: 0, lng: 0 });
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Nenhum poste próximo'), 'error');
  });

  it('fails if origin pole is no longer in topology', () => {
    mockFindNearestPole.mockReturnValue({ id: 'P1' });
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    // Set a pending origin that doesn't exist in poles array
    const paramsWithGhost = { ...mockParams, appState: { ...mockAppState, btTopology: { ...mockAppState.btTopology, poles: [] } } };
    
    const { result: ghostResult } = renderHook(() => useBtEdgeOperations(paramsWithGhost as any));

    act(() => {
        ghostResult.current.handleBtMapClickAddEdge({ lat: 10, lng: 10 }); // Select P1 as origin
    });

    mockFindNearestPole.mockReturnValue({ id: 'P2' });
    act(() => {
        ghostResult.current.handleBtMapClickAddEdge({ lat: 11, lng: 11 }); // Try to select P2
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('não encontrado'), 'error');
  });

  it('handles edge deletion', () => {
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    act(() => {
      result.current.handleBtDeleteEdge('E1');
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('removido'), 'info', expect.anything());
  });

  it('sets edge change flag', () => {
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    act(() => {
      result.current.handleBtSetEdgeChangeFlag('E1', 'replace');
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('SUBSTITUIÇÃO'), 'info', expect.anything());
  });

  it('manages conductors (add/remove)', () => {
    const appStateWithEdge = {
        ...mockAppState,
        btTopology: {
            ...mockAppState.btTopology,
            edges: [{ id: 'E1', conductors: [{ id: 'c1', quantity: 1, conductorName: '70 Al' }] }]
        }
    };
    const { result } = renderHook(() => useBtEdgeOperations({ ...mockParams, appState: appStateWithEdge } as any));

    // Add another
    act(() => {
      result.current.handleBtQuickAddEdgeConductor('E1', '70 Al');
    });
    expect(mockSetAppState).toHaveBeenCalled();

    // Remove one
    act(() => {
        result.current.handleBtQuickRemoveEdgeConductor('E1', '70 Al');
    });
    expect(mockSetAppState).toHaveBeenCalledTimes(2);
  });

  it('handles conductor removal when none exist', () => {
    const { result } = renderHook(() => useBtEdgeOperations(mockParams)); // Empty edges
    
    act(() => {
        result.current.handleBtQuickRemoveEdgeConductor('E-NONE', '70 Al');
    });
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('não encontrado'), 'error');
  });

  it('updates manual length', () => {
    const { result } = renderHook(() => useBtEdgeOperations(mockParams));

    act(() => {
      result.current.handleBtSetEdgeLengthMeters('E1', 25.5);
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('25.50 m'), 'success', expect.anything());
  });
});
