import { renderHook, act } from '@testing-library/react';
import { useBtPoleClandestinoHandlers } from '@/hooks/useBtPoleClandestinoHandlers';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useBtPoleClandestinoHandlers hook', () => {
  const mockShowToast = vi.fn();
  const mockUndo = vi.fn();
  const mockApplyProjectTypeSwitch = vi.fn();
  const mockSetPendingNormalClassificationPoles = vi.fn();
  const mockSetAppState = vi.fn();

  const mockParams = {
    btTopology: { poles: [], transformers: [], edges: [] },
    settings: { projectType: 'ramais' },
    setAppState: mockSetAppState,
    showToast: mockShowToast,
    undo: mockUndo,
    applyProjectTypeSwitch: mockApplyProjectTypeSwitch,
    setPendingNormalClassificationPoles: mockSetPendingNormalClassificationPoles,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers normalToClandestinoModal when switching from ramais to clandestino with existing clients', () => {
    const topologyWithClients = {
      poles: [{ id: 'p1', ramais: [{ id: 'r1', quantity: 1, ramalType: 'monofasico' }] }],
      transformers: [],
      edges: []
    } as any;

    const { result } = renderHook(() => useBtPoleClandestinoHandlers({
      ...mockParams,
      btTopology: topologyWithClients
    }));

    act(() => {
      result.current.onProjectTypeChange('clandestino');
    });

    expect(result.current.normalToClandestinoModal).not.toBeNull();
    expect(result.current.normalToClandestinoModal?.totalNormalClients).toBe(1);
    expect(mockApplyProjectTypeSwitch).not.toHaveBeenCalled();
  });

  it('switches project type immediately if no conflicting clients exist', () => {
    const { result } = renderHook(() => useBtPoleClandestinoHandlers(mockParams));

    act(() => {
      result.current.onProjectTypeChange('clandestino');
    });

    expect(result.current.normalToClandestinoModal).toBeNull();
    expect(mockSetAppState).toHaveBeenCalled();
  });

  it('handles Normal -> Clandestino (Keep Clients)', () => {
    const { result } = renderHook(() => useBtPoleClandestinoHandlers(mockParams));

    act(() => {
      result.current.handleNormalToClandestinoKeepClients();
    });

    expect(mockApplyProjectTypeSwitch).toHaveBeenCalledWith('clandestino');
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("mantendo clientes normais"), "info", expect.any(Object));
  });

  it('handles Clandestino -> Normal (Classify Later)', () => {
    const { result } = renderHook(() => useBtPoleClandestinoHandlers(mockParams));

    // Manually set modal state
    act(() => {
        result.current.setClandestinoToNormalModal({ poles: [{ poleId: 'p1', title: 'P1' }] });
    });

    act(() => {
      result.current.handleClandestinoToNormalClassifyLater();
    });

    expect(mockSetPendingNormalClassificationPoles).toHaveBeenCalledWith([{ poleId: 'p1', title: 'P1' }]);
    expect(mockApplyProjectTypeSwitch).toHaveBeenCalledWith('ramais');
  });
});
