import React from "react";
import { BtTopology } from "../types";

export function useAppInspectedElement({
  selectedPoleId,
  selectedTransformerId,
  selectedEdgeId,
  btTopology,
  btAccumulatedByPole,
}: {
  selectedPoleId: string | null;
  selectedTransformerId: string | null;
  selectedEdgeId: string | null;
  btTopology: BtTopology;
  btAccumulatedByPole: any;
}) {
  return React.useMemo(() => {
    if (selectedPoleId) {
      const pole = btTopology.poles.find((p) => p.id === selectedPoleId);
      const accData = btAccumulatedByPole?.[selectedPoleId];
      return {
        type: "pole" as const,
        id: selectedPoleId,
        data: pole,
        accumulatedData: accData,
      };
    }
    if (selectedTransformerId) {
      const transformer = btTopology.transformers.find(
        (t) => t.id === selectedTransformerId,
      );
      return {
        type: "transformer" as const,
        id: selectedTransformerId,
        data: transformer,
      };
    }
    if (selectedEdgeId) {
      const edge = btTopology.edges.find((e) => e.id === selectedEdgeId);
      return { type: "edge" as const, id: selectedEdgeId, data: edge };
    }
    return null;
  }, [
    selectedPoleId,
    selectedTransformerId,
    selectedEdgeId,
    btTopology.poles,
    btTopology.transformers,
    btTopology.edges,
    btAccumulatedByPole,
  ]);
}
