import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBtNavigationState } from '../src/hooks/useBtNavigationState';
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

describe('useBtNavigationState', () => {
  it('gera fly-to do poste e do transformador selecionados', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useBtNavigationState({ btTopology: createTopology(), showToast }));

    act(() => {
      result.current.handleBtSelectedPoleChange('P2');
      result.current.handleBtSelectedTransformerChange('T2');
    });

    expect(result.current.btPoleFlyToTarget).toMatchObject({ lat: -22.825646, lng: -43.325856 });
    expect(result.current.btTransformerFlyToTarget).toMatchObject({ lat: -22.825646, lng: -43.325856 });
  });

  it('gera fly-to do trecho a partir do ponto médio dos postes', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useBtNavigationState({ btTopology: createTopology(), showToast }));

    act(() => {
      result.current.handleBtSelectedEdgeChange('E1');
    });

    expect(result.current.btEdgeFlyToTarget).toMatchObject({
      lat: (-22.825546 + -22.825646) / 2,
      lng: (-43.325956 + -43.325856) / 2,
    });
  });

  it('dispara alerta apenas uma vez para a mesma assinatura de conflito', () => {
    const showToast = vi.fn();
    const topology = createTopology();
    const { rerender } = renderHook(
      ({ btTopology }) => useBtNavigationState({ btTopology, showToast }),
      { initialProps: { btTopology: topology } }
    );

    expect(showToast).toHaveBeenCalledTimes(1);

    rerender({ btTopology: createTopology() });
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
