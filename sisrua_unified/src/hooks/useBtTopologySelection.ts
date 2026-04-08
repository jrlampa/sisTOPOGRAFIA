import { useEffect, useMemo, useState } from 'react';
import type { BtTopology } from '../types';

interface UseBtTopologySelectionParams {
  btTopology: BtTopology;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
}

export function useBtTopologySelection({
  btTopology,
  onSelectedPoleChange,
  onSelectedTransformerChange,
  onSelectedEdgeChange,
}: UseBtTopologySelectionParams) {
  const [selectedPoleId, setSelectedPoleId] = useState<string>('');
  const [selectedTransformerId, setSelectedTransformerId] = useState<string>('');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('');
  const [isPoleDropdownOpen, setIsPoleDropdownOpen] = useState(false);
  const [isTransformerDropdownOpen, setIsTransformerDropdownOpen] = useState(false);

  useEffect(() => {
    if (!selectedPoleId && btTopology.poles.length > 0) {
      setSelectedPoleId(btTopology.poles[0].id);
    }

    if (selectedPoleId && !btTopology.poles.some((pole) => pole.id === selectedPoleId)) {
      setSelectedPoleId(btTopology.poles[0]?.id || '');
    }

    setIsPoleDropdownOpen(false);
  }, [btTopology.poles, selectedPoleId]);

  useEffect(() => {
    if (!selectedTransformerId && btTopology.transformers.length > 0) {
      setSelectedTransformerId(btTopology.transformers[0].id);
    }

    if (selectedTransformerId && !btTopology.transformers.some((transformer) => transformer.id === selectedTransformerId)) {
      setSelectedTransformerId(btTopology.transformers[0]?.id || '');
    }

    setIsTransformerDropdownOpen(false);
  }, [btTopology.transformers, selectedTransformerId]);

  useEffect(() => {
    if (!selectedEdgeId && btTopology.edges.length > 0) {
      setSelectedEdgeId(btTopology.edges[0].id);
    }

    if (selectedEdgeId && !btTopology.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(btTopology.edges[0]?.id || '');
    }
  }, [btTopology.edges, selectedEdgeId]);

  const selectedPole = useMemo(
    () => btTopology.poles.find((pole) => pole.id === selectedPoleId) || null,
    [btTopology.poles, selectedPoleId]
  );

  const selectedTransformer = useMemo(
    () => btTopology.transformers.find((transformer) => transformer.id === selectedTransformerId) || null,
    [btTopology.transformers, selectedTransformerId]
  );

  const selectedEdge = useMemo(
    () => btTopology.edges.find((edge) => edge.id === selectedEdgeId) || null,
    [btTopology.edges, selectedEdgeId]
  );

  const selectPole = (poleId: string) => {
    setSelectedPoleId(poleId);
    onSelectedPoleChange?.(poleId);
    setIsPoleDropdownOpen(false);
  };

  const selectTransformer = (transformerId: string) => {
    setSelectedTransformerId(transformerId);
    onSelectedTransformerChange?.(transformerId);
    setIsTransformerDropdownOpen(false);
  };

  const selectEdge = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    onSelectedEdgeChange?.(edgeId);
  };

  return {
    selectedPoleId,
    selectedTransformerId,
    selectedEdgeId,
    selectedPole,
    selectedTransformer,
    selectedEdge,
    isPoleDropdownOpen,
    isTransformerDropdownOpen,
    setSelectedPoleId,
    setSelectedTransformerId,
    setSelectedEdgeId,
    setIsPoleDropdownOpen,
    setIsTransformerDropdownOpen,
    selectPole,
    selectTransformer,
    selectEdge,
  };
}
