import { renderHook } from '@testing-library/react';
import { useAppInspectedElement } from '@/hooks/useAppInspectedElement';
import { describe, it, expect } from 'vitest';

describe('useAppInspectedElement hook', () => {
  const mockTopology = {
    poles: [{ id: 'p1', title: 'Pole 1' }],
    transformers: [{ id: 't1', title: 'TR 1' }],
    edges: [{ id: 'e1', fromPoleId: 'p1', toPoleId: 'p2' }],
  } as any;

  const mockAccumulated = {
    p1: { poleId: 'p1', dvAccumPercent: 5 }
  };

  it('returns pole data when selectedPoleId is provided', () => {
    const { result } = renderHook(() => useAppInspectedElement({
      selectedPoleId: 'p1',
      selectedTransformerId: null,
      selectedEdgeId: null,
      btTopology: mockTopology,
      btAccumulatedByPole: mockAccumulated
    }));

    expect(result.current?.type).toBe('pole');
    expect(result.current?.id).toBe('p1');
    expect(result.current?.data).toEqual(mockTopology.poles[0]);
    expect((result.current as any).accumulatedData).toEqual(mockAccumulated.p1);
  });

  it('returns transformer data when selectedTransformerId is provided', () => {
    const { result } = renderHook(() => useAppInspectedElement({
      selectedPoleId: null,
      selectedTransformerId: 't1',
      selectedEdgeId: null,
      btTopology: mockTopology,
      btAccumulatedByPole: {}
    }));

    expect(result.current?.type).toBe('transformer');
    expect(result.current?.data).toEqual(mockTopology.transformers[0]);
  });

  it('returns edge data when selectedEdgeId is provided', () => {
    const { result } = renderHook(() => useAppInspectedElement({
      selectedPoleId: null,
      selectedTransformerId: null,
      selectedEdgeId: 'e1',
      btTopology: mockTopology,
      btAccumulatedByPole: {}
    }));

    expect(result.current?.type).toBe('edge');
    expect(result.current?.data).toEqual(mockTopology.edges[0]);
  });

  it('returns null when nothing is selected', () => {
    const { result } = renderHook(() => useAppInspectedElement({
      selectedPoleId: null,
      selectedTransformerId: null,
      selectedEdgeId: null,
      btTopology: mockTopology,
      btAccumulatedByPole: {}
    }));

    expect(result.current).toBeNull();
  });
});
