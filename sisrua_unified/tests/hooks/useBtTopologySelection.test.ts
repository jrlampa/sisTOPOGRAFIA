import { renderHook, act } from '@testing-library/react';
import { useBtTopologySelection } from '@/hooks/useBtTopologySelection';
import { describe, it, expect, vi } from 'vitest';

describe('useBtTopologySelection hook', () => {
  const mockTopology = {
    poles: [{ id: 'p1' }, { id: 'p2' }],
    transformers: [{ id: 't1' }],
    edges: [{ id: 'e1' }],
  } as any;

  it('selects first items by default', () => {
    const { result } = renderHook(() => useBtTopologySelection({ btTopology: mockTopology }));
    
    expect(result.current.selectedPoleId).toBe('p1');
    expect(result.current.selectedTransformerId).toBe('t1');
    expect(result.current.selectedEdgeId).toBe('e1');
  });

  it('updates selection when calling select functions', () => {
    const onPoleChange = vi.fn();
    const { result } = renderHook(() => useBtTopologySelection({ 
      btTopology: mockTopology,
      onSelectedPoleChange: onPoleChange 
    }));

    act(() => {
      result.current.selectPole('p2');
    });

    expect(result.current.selectedPoleId).toBe('p2');
    expect(onPoleChange).toHaveBeenCalledWith('p2');
    expect(result.current.selectedPole).toEqual({ id: 'p2' });
  });

  it('resets selection if current item is removed from topology', () => {
    const { result, rerender } = renderHook(
      ({ topology }) => useBtTopologySelection({ btTopology: topology }),
      { initialProps: { topology: mockTopology } }
    );

    expect(result.current.selectedPoleId).toBe('p1');

    const newTopology = {
      poles: [{ id: 'p2' }],
      transformers: [],
      edges: [],
    } as any;

    rerender({ topology: newTopology });

    expect(result.current.selectedPoleId).toBe('p2');
    expect(result.current.selectedTransformerId).toBe('');
  });

  it('handles empty topology', () => {
    const emptyTopology = { poles: [], transformers: [], edges: [] };
    const { result } = renderHook(() => useBtTopologySelection({ btTopology: emptyTopology }));
    
    expect(result.current.selectedPoleId).toBe('');
    expect(result.current.selectedPole).toBeNull();
  });
});
