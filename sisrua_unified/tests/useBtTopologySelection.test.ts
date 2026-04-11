import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBtTopologySelection } from '../src/hooks/useBtTopologySelection';
import type { BtTopology } from '../src/types';

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

describe('useBtTopologySelection', () => {
  it('seleciona automaticamente o primeiro poste, trafo e trecho disponíveis', () => {
    const { result } = renderHook(() => useBtTopologySelection({ btTopology: createTopology() }));

    expect(result.current.selectedPoleId).toBe('P1');
    expect(result.current.selectedTransformerId).toBe('T1');
    expect(result.current.selectedEdgeId).toBe('E1');
    expect(result.current.selectedPole?.title).toBe('Poste 1');
    expect(result.current.selectedTransformer?.title).toBe('Trafo 1');
  });

  it('dispara callbacks e fecha dropdowns ao trocar poste e trafo', () => {
    const onSelectedPoleChange = vi.fn();
    const onSelectedTransformerChange = vi.fn();
    const { result } = renderHook(() => useBtTopologySelection({
      btTopology: createTopology(),
      onSelectedPoleChange,
      onSelectedTransformerChange,
    }));

    act(() => {
      result.current.setIsPoleDropdownOpen(true);
      result.current.setIsTransformerDropdownOpen(true);
      result.current.selectPole('P2');
      result.current.selectTransformer('T2');
    });

    expect(result.current.selectedPoleId).toBe('P2');
    expect(result.current.selectedTransformerId).toBe('T2');
    expect(result.current.isPoleDropdownOpen).toBe(false);
    expect(result.current.isTransformerDropdownOpen).toBe(false);
    expect(onSelectedPoleChange).toHaveBeenCalledWith('P2');
    expect(onSelectedTransformerChange).toHaveBeenCalledWith('T2');
  });

  it('reconcilia seleção quando item selecionado deixa de existir', () => {
    const topology = createTopology();
    const { result, rerender } = renderHook(
      ({ btTopology }) => useBtTopologySelection({ btTopology }),
      { initialProps: { btTopology: topology } }
    );

    act(() => {
      result.current.selectPole('P2');
      result.current.selectTransformer('T2');
    });

    rerender({
      btTopology: {
        poles: [topology.poles[0]],
        transformers: [topology.transformers[0]],
        edges: topology.edges,
      },
    });

    expect(result.current.selectedPoleId).toBe('P1');
    expect(result.current.selectedTransformerId).toBe('T1');
  });

  it('dispara callback ao trocar trecho', () => {
    const onSelectedEdgeChange = vi.fn();
    const { result } = renderHook(() => useBtTopologySelection({
      btTopology: createTopology(),
      onSelectedEdgeChange,
    }));

    act(() => {
      result.current.selectEdge('E1');
    });

    expect(result.current.selectedEdgeId).toBe('E1');
    expect(onSelectedEdgeChange).toHaveBeenCalledWith('E1');
  });
});
