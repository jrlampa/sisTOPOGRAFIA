import { useEffect, useRef, useState } from 'react';
import type { BtTopology } from '../types';
import { findTransformerConflictsWithoutSectioning } from '../utils/btCalculations';
import type { ToastType } from '../components/Toast';

export interface FlyToTarget {
  lat: number;
  lng: number;
  token: number;
}

interface UseBtNavigationStateParams {
  btTopology: BtTopology;
  showToast: (message: string, type: ToastType) => void;
}

const buildFlyToTarget = (lat: number, lng: number): FlyToTarget => ({
  lat,
  lng,
  token: Date.now(),
});

export function useBtNavigationState({ btTopology, showToast }: UseBtNavigationStateParams) {
  const [btEdgeFlyToTarget, setBtEdgeFlyToTarget] = useState<FlyToTarget | null>(null);
  const [btPoleFlyToTarget, setBtPoleFlyToTarget] = useState<FlyToTarget | null>(null);
  const [btTransformerFlyToTarget, setBtTransformerFlyToTarget] = useState<FlyToTarget | null>(null);
  const lastTransformerConflictSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const conflictGroups = findTransformerConflictsWithoutSectioning(btTopology);
    if (conflictGroups.length === 0) {
      lastTransformerConflictSignatureRef.current = null;
      return;
    }

    const signature = conflictGroups
      .map((group) => group.transformerIds.join(','))
      .sort((a, b) => a.localeCompare(b))
      .join('|');

    if (signature === lastTransformerConflictSignatureRef.current) {
      return;
    }

    lastTransformerConflictSignatureRef.current = signature;

    const firstConflict = conflictGroups[0];
    const transformerLabels = firstConflict.transformerIds
      .map((transformerId) => btTopology.transformers.find((item) => item.id === transformerId)?.title ?? transformerId)
      .join(', ');
    const extraConflictLabel = conflictGroups.length > 1
      ? ` Há mais ${conflictGroups.length - 1} rede(s) BT em conflito.`
      : '';

    showToast(
      `Alerta BT: dois ou mais transformadores na mesma rede sem separação física (${transformerLabels}).${extraConflictLabel}`,
      'error'
    );
  }, [btTopology, showToast]);

  const handleBtSelectedEdgeChange = (edgeId: string) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      return;
    }

    const fromPole = btTopology.poles.find((pole) => pole.id === edge.fromPoleId);
    const toPole = btTopology.poles.find((pole) => pole.id === edge.toPoleId);
    if (!fromPole || !toPole) {
      return;
    }

    setBtEdgeFlyToTarget(buildFlyToTarget((fromPole.lat + toPole.lat) / 2, (fromPole.lng + toPole.lng) / 2));
  };

  const handleBtSelectedPoleChange = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      return;
    }

    setBtPoleFlyToTarget(buildFlyToTarget(pole.lat, pole.lng));
  };

  const handleBtSelectedTransformerChange = (transformerId: string) => {
    const transformer = btTopology.transformers.find((candidate) => candidate.id === transformerId);
    if (!transformer) {
      return;
    }

    setBtTransformerFlyToTarget(buildFlyToTarget(transformer.lat, transformer.lng));
  };

  return {
    btEdgeFlyToTarget,
    btPoleFlyToTarget,
    btTransformerFlyToTarget,
    handleBtSelectedEdgeChange,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
  };
}
