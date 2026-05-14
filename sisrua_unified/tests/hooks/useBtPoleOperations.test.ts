import { renderHook, act } from '@testing-library/react';
import { useBtPoleOperations } from '@/hooks/useBtPoleOperations';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpatialJurisdictionService } from '@/services/spatialJurisdictionService';

// Mock SpatialJurisdictionService
vi.mock('@/services/spatialJurisdictionService', () => ({
  SpatialJurisdictionService: {
    isPointInJurisdiction: vi.fn(() => true),
  }
}));

describe('useBtPoleOperations hook', () => {
  const mockAppState = {
    btTopology: { poles: [], transformers: [], edges: [] },
    settings: { projectType: 'ramais' },
    polygon: [],
    radius: 100,
    center: { lat: 0, lng: 0 },
  } as any;
  const mockSetAppState = vi.fn();
  const mockShowToast = vi.fn();
  const mockUndo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a pole correctly when in jurisdiction', () => {
    const { result } = renderHook(() => useBtPoleOperations({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    const location = { lat: 10, lng: 20 };
    act(() => {
      result.current.insertBtPoleAtLocation(location);
    });

    expect(mockSetAppState).toHaveBeenCalledWith(
        expect.any(Function), // it uses functional update
        true
    );
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("inserido"), "success", expect.any(Object));
  });

  it('blocks pole insertion when out of jurisdiction', () => {
    vi.mocked(SpatialJurisdictionService.isPointInJurisdiction).mockReturnValue(false);

    const { result } = renderHook(() => useBtPoleOperations({
      appState: mockAppState,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    const location = { lat: 50, lng: 50 };
    act(() => {
      result.current.insertBtPoleAtLocation(location);
    });

    expect(mockSetAppState).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("fora da jurisdição"), "error");
  });

  it('deletes a pole correctly', () => {
    const appWithPole = {
        ...mockAppState,
        btTopology: { poles: [{ id: 'p1', lat: 0, lng: 0 }], transformers: [], edges: [] }
    };
    const { result } = renderHook(() => useBtPoleOperations({
      appState: appWithPole,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    act(() => {
      result.current.handleBtDeletePole('p1');
    });

    expect(mockSetAppState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("removido"), "info", expect.any(Object));
  });

  it('renames a pole correctly', () => {
    const appWithPole = {
        ...mockAppState,
        btTopology: { poles: [{ id: 'p1', lat: 0, lng: 0, title: 'Old' }], transformers: [], edges: [] }
    };
    const { result } = renderHook(() => useBtPoleOperations({
      appState: appWithPole,
      setAppState: mockSetAppState,
      showToast: mockShowToast,
      undo: mockUndo,
    }));

    act(() => {
      result.current.handleBtRenamePole('p1', 'New Name');
    });

    expect(mockSetAppState).toHaveBeenCalled();
  });
});
