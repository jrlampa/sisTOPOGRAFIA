import { renderHook, act } from '@testing-library/react';
import { useBtCrudHandlers } from '@/hooks/useBtCrudHandlers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBtPoleOperations } from '@/hooks/useBtPoleOperations';

const mockPoleOps = {
  insertBtPoleAtLocation: vi.fn(),
  findNearestPole: vi.fn(),
  getPoleClandestinoClients: vi.fn(() => 0),
};

// Mock the specialized hooks
vi.mock('@/hooks/useBtPoleOperations', () => ({
  useBtPoleOperations: vi.fn(() => mockPoleOps)
}));
vi.mock('@/hooks/useBtEdgeOperations', () => ({
  useBtEdgeOperations: vi.fn(() => ({
    handleBtMapClickAddEdge: vi.fn(),
    clearPendingBtEdge: vi.fn(),
  }))
}));
vi.mock('@/hooks/useBtTransformerOperations', () => ({
  useBtTransformerOperations: vi.fn(() => ({
    handleBtMapClickAddTransformer: vi.fn(),
  }))
}));

// Mock normalization utils
vi.mock('@/utils/btNormalization', () => ({
  EMPTY_BT_TOPOLOGY: { poles: [], transformers: [], edges: [] },
  normalizeBtPoles: vi.fn((p) => p),
  normalizeBtTransformers: vi.fn((t) => t),
  normalizeBtEdges: vi.fn((e) => e),
  getEdgeChangeFlag: vi.fn(() => 'new'),
}));

// Mock downloads
vi.mock('@/utils/downloads', () => ({
  downloadCsv: vi.fn(),
  downloadJson: vi.fn(),
}));

describe('useBtCrudHandlers hook', () => {
  const mockAppState = {
    btTopology: { poles: [], transformers: [], edges: [] },
    settings: { 
        btEditorMode: 'none',
        projectMetadata: { projectName: 'Test Project' },
        layers: { btNetwork: true }
    },
    btExportHistory: [],
  } as any;
  const mockSetAppState = vi.fn();
  const mockShowToast = vi.fn();
  const mockUndo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates topology correctly', () => {
    const { result } = renderHook(() => useBtCrudHandlers({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    const newTopology = { poles: [{ id: 'p1' }], transformers: [], edges: [] } as any;
    act(() => {
      result.current.updateBtTopology(newTopology);
    });

    expect(mockSetAppState).toHaveBeenCalledWith(
      expect.objectContaining({
        btTopology: expect.objectContaining({
          poles: expect.arrayContaining([{ id: 'p1' }])
        })
      }),
      true,
      "Topologia Atualizada"
    );
  });

  it('delegates map click based on editor mode', () => {
    const appStateAddPole = { 
        ...mockAppState, 
        settings: { ...mockAppState.settings, btEditorMode: 'add-pole' } 
    };
    
    const { result } = renderHook(() => useBtCrudHandlers({
      appState: appStateAddPole,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    const location = { lat: 10, lng: 20 };
    act(() => {
      result.current.handleBtMapClick(location);
    });

    expect(mockPoleOps.insertBtPoleAtLocation).toHaveBeenCalledWith(location);
  });

  it('handles reset topology with confirmation', () => {
    const appStateWithData = {
        ...mockAppState,
        btTopology: { poles: [{ id: 'p1' }], transformers: [], edges: [] }
    };

    const { result } = renderHook(() => useBtCrudHandlers({
      appState: appStateWithData,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    act(() => {
      result.current.handleResetBtTopology();
    });

    expect(result.current.resetConfirmOpen).toBe(true);

    act(() => {
      result.current.handleConfirmResetBtTopology();
    });

    expect(result.current.resetConfirmOpen).toBe(false);
    expect(mockSetAppState).toHaveBeenCalledWith(
        expect.objectContaining({ btTopology: { poles: [], transformers: [], edges: [] } }),
        true
    );
  });

  it('clears export history', () => {
    const { result } = renderHook(() => useBtCrudHandlers({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    act(() => {
      result.current.clearBtExportHistory();
    });

    expect(mockSetAppState).toHaveBeenCalledWith(
        expect.objectContaining({ btExportHistory: [] }),
        true
    );
    expect(mockShowToast).toHaveBeenCalledWith("Histórico BT limpo.", "info");
  });
});
