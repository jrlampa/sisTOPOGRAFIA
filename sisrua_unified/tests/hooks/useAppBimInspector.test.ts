import { renderHook, act } from '@testing-library/react';
import { useAppBimInspector } from '@/hooks/useAppBimInspector';
import { describe, it, expect, vi } from 'vitest';

describe('useAppBimInspector hook', () => {
  const mockTopology = {
    poles: [{ id: 'p1', title: 'P1' }],
    transformers: [{ id: 't1', poleId: 'p1' }],
  } as any;

  const mockAccumulated = [{ poleId: 'p1', dv: 5 }];

  it('opens inspector automatically when a single pole is selected', () => {
    const { result, rerender } = renderHook(
      (props) => useAppBimInspector(props),
      { 
        initialProps: { 
            selectedPoleId: null, 
            selectedPoleIds: [], 
            btTopology: mockTopology, 
            btAccumulatedByPole: mockAccumulated 
        } 
      }
    );

    expect(result.current.isBimInspectorOpen).toBe(false);

    rerender({ 
        selectedPoleId: 'p1', 
        selectedPoleIds: ['p1'], 
        btTopology: mockTopology, 
        btAccumulatedByPole: mockAccumulated 
    });

    expect(result.current.isBimInspectorOpen).toBe(true);
    expect(result.current.inspectedPole?.id).toBe('p1');
    expect(result.current.inspectedTransformer?.poleId).toBe('p1');
    expect(result.current.inspectedAccumulatedData?.poleId).toBe('p1');
  });

  it('does not open inspector for multi-selection', () => {
    const { result } = renderHook(() => useAppBimInspector({
      selectedPoleId: null,
      selectedPoleIds: ['p1', 'p2'],
      btTopology: mockTopology,
      btAccumulatedByPole: mockAccumulated
    }));

    expect(result.current.isBimInspectorOpen).toBe(false);
  });
});
