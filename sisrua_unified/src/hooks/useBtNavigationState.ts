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
  const [selectedPoleId, setSelectedPoleId] = useState<string>("");
  const [selectedPoleIds, setSelectedPoleIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");
  const [selectedTransformerId, setSelectedTransformerId] = useState<string>("");
  const lastTransformerConflictSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const conflictGroups = findTransformerConflictsWithoutSectioning(btTopology);
    if (conflictGroups.length === 0) {
      lastTransformerConflictSignatureRef.current = null;
      return;
    }

    const signature = conflictGroups
      .map((group: any) => group.transformerIds.join(','))
      .sort((a: string, b: string) => a.localeCompare(b))
      .join('|');

    if (signature === lastTransformerConflictSignatureRef.current) {
      return;
    }

    lastTransformerConflictSignatureRef.current = signature;

    const firstConflict = conflictGroups[0];
    const transformerLabels = firstConflict.transformerIds
      .map((transformerId: string) => btTopology.transformers.find((item) => item.id === transformerId)?.title ?? transformerId)
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

    setSelectedEdgeId(edgeId);
    setBtEdgeFlyToTarget(buildFlyToTarget((fromPole.lat + toPole.lat) / 2, (fromPole.lng + toPole.lng) / 2));
  };

  const handleBtSelectedPoleChange = (poleId: string, isShiftSelect?: boolean) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      return;
    }

    if (isShiftSelect) {
      setSelectedPoleIds((prev) => {
        const next = prev.includes(poleId)
          ? prev.filter((id) => id !== poleId)
          : [...prev, poleId];
        
        if (next.length === 1) {
          setSelectedPoleId(next[0]);
        } else {
          setSelectedPoleId("");
        }
        return next;
      });
    } else {
      setSelectedPoleIds([poleId]);
      setSelectedPoleId(poleId);
    }

    setBtPoleFlyToTarget(buildFlyToTarget(pole.lat, pole.lng));
  };

  const handleBtSelectedTransformerChange = (transformerId: string) => {
    const transformer = btTopology.transformers.find((candidate) => candidate.id === transformerId);
    if (!transformer) {
      return;
    }

    setSelectedTransformerId(transformerId);
    setBtTransformerFlyToTarget(buildFlyToTarget(transformer.lat, transformer.lng));
  };

  return {
    btEdgeFlyToTarget,
    btPoleFlyToTarget,
    btTransformerFlyToTarget,
    selectedPoleId,
    selectedPoleIds,
    selectedEdgeId,
    selectedTransformerId,
    handleBtSelectedEdgeChange,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
    setSelectedPoleId,
    setSelectedPoleIds,
    setSelectedEdgeId,
    setSelectedTransformerId,
  };
}
