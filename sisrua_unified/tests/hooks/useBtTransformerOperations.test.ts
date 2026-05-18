import { renderHook, act } from '@testing-library/react';
import { useBtTransformerOperations } from '@/hooks/useBtTransformerOperations';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useBtTransformerOperations hook', () => {
  const mockFindNearestPole = vi.fn();
  const mockSetAppState = vi.fn();
  const mockShowToast = vi.fn();
  const mockUndo = vi.fn();
  
  const mockAppState = {
    btTopology: {
      poles: [{ id: 'p1', lat: 0, lng: 0, title: 'Pole 1' }],
      transformers: [],
      edges: []
    }
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a transformer to a pole correctly', () => {
    mockFindNearestPole.mockReturnValue({ id: 'p1', title: 'Pole 1', lat: 0, lng: 0 });
    
    const { result } = renderHook(() => useBtTransformerOperations({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      findNearestPole: mockFindNearestPole,
      undo: mockUndo
    }));

    act(() => {
      result.current.handleBtMapClickAddTransformer({ lat: 0, lng: 0 });
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("inserido em Pole 1"), "success", expect.any(Object));
  });

  it('blocks adding transformer if no pole is nearby', () => {
    mockFindNearestPole.mockReturnValue(null);
    
    const { result } = renderHook(() => useBtTransformerOperations({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      findNearestPole: mockFindNearestPole,
      undo: mockUndo
    }));

    act(() => {
      result.current.handleBtMapClickAddTransformer({ lat: 1, lng: 1 });
    });

    expect(mockSetAppState).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("atrelado a um poste"), "error");
  });

  it('deletes a transformer correctly', () => {
    const appWithTrafo = {
        ...mockAppState,
        btTopology: { 
            ...mockAppState.btTopology, 
            transformers: [{ id: 'tr1', poleId: 'p1', title: 'TR 1' }] 
        }
    };
    const { result } = renderHook(() => useBtTransformerOperations({
      appState: appWithTrafo,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      findNearestPole: mockFindNearestPole,
      undo: mockUndo
    }));

    act(() => {
      result.current.handleBtDeleteTransformer('tr1');
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("removido"), "info", expect.any(Object));
  });

  it('toggles transformer on pole', () => {
    const { result } = renderHook(() => useBtTransformerOperations({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      findNearestPole: mockFindNearestPole,
      undo: mockUndo
    }));

    // Add via toggle
    act(() => {
      result.current.handleBtToggleTransformerOnPole('p1');
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("adicionado em Pole 1"), "success", expect.any(Object));
  });
});
