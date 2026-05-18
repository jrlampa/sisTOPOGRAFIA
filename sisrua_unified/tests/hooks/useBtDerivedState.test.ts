import { renderHook, act } from '@testing-library/react';
import { useBtDerivedState } from '@/hooks/useBtDerivedState';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as btDerivedService from '@/services/btDerivedService';

vi.mock('@/services/btDerivedService');

describe('useBtDerivedState hook', () => {
  const mockAppState = {
    btTopology: { poles: [], transformers: [], edges: [] },
    settings: { projectType: 'ramais', clandestinoAreaM2: 0 },
  } as any;
  const mockSetAppState = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates derived state after debounce', async () => {
    const mockPayload = {
      accumulatedByPole: [{ poleId: 'p1', dvAccumPercent: 8 }],
      estimatedByTransformer: [{ transformerId: 't1', assignedClients: 10, estimatedDemandKva: 15 }],
      summary: { poles: 1, transformers: 1, edges: 0, totalLengthMeters: 0, transformerDemandKva: 15 },
      pointDemandKva: 1.5,
      sectioningImpact: null,
      clandestinoDisplay: null,
      transformersDerived: [],
    };

    vi.mocked(btDerivedService.fetchBtDerivedState).mockResolvedValue(mockPayload as any);

    const { result } = renderHook(() => useBtDerivedState({ 
      appState: mockAppState, 
      setAppState: mockSetAppState 
    }));

    expect(result.current.isCalculating).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(btDerivedService.fetchBtDerivedState).toHaveBeenCalled();
    expect(result.current.isCalculating).toBe(false);
    expect(result.current.btAccumulatedByPole).toEqual(mockPayload.accumulatedByPole);
    expect(result.current.btCriticalPoleId).toBe('p1');
    expect(result.current.btTransformerDebugById['t1']).toEqual({
      assignedClients: 10,
      estimatedDemandKva: 15,
    });
  });

  it('identifies critical pole correctly based on dvAccumPercent', async () => {
    const mockPayload = {
      accumulatedByPole: [
        { poleId: 'p1', dvAccumPercent: 5 },
        { poleId: 'p2', dvAccumPercent: 9 },
      ],
      estimatedByTransformer: [],
      summary: {},
      pointDemandKva: 0,
    };

    vi.mocked(btDerivedService.fetchBtDerivedState).mockResolvedValue(mockPayload as any);

    const { result } = renderHook(() => useBtDerivedState({ 
      appState: mockAppState, 
      setAppState: mockSetAppState 
    }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.btCriticalPoleId).toBe('p2');
  });

  it('returns null for critical pole if dvAccumPercent is below threshold', async () => {
    const mockPayload = {
      accumulatedByPole: [
        { poleId: 'p1', dvAccumPercent: 5 },
      ],
      estimatedByTransformer: [],
      summary: {},
      pointDemandKva: 0,
    };

    vi.mocked(btDerivedService.fetchBtDerivedState).mockResolvedValue(mockPayload as any);

    const { result } = renderHook(() => useBtDerivedState({ 
      appState: mockAppState, 
      setAppState: mockSetAppState 
    }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.btCriticalPoleId).toBeNull();
  });
});
