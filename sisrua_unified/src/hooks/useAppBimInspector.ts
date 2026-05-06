import React from "react";
import { BtTopology } from "../types";

export function useAppBimInspector({
  selectedPoleId,
  selectedPoleIds,
  btTopology,
  btAccumulatedByPole,
}: {
  selectedPoleId: string | null;
  selectedPoleIds: string[];
  btTopology: BtTopology;
  btAccumulatedByPole: any[];
}) {
  const [isBimInspectorOpen, setIsBimInspectorOpen] = React.useState(false);

  React.useEffect(() => {
    if (selectedPoleId && selectedPoleIds.length === 1) {
      setIsBimInspectorOpen(true);
    }
  }, [selectedPoleId, selectedPoleIds.length]);

  const inspectedPole = React.useMemo(
    () => btTopology.poles.find((p) => p.id === selectedPoleId) || null,
    [btTopology.poles, selectedPoleId],
  );

  const inspectedTransformer = React.useMemo(
    () =>
      btTopology.transformers.find((t) => t.poleId === selectedPoleId) || null,
    [btTopology.transformers, selectedPoleId],
  );

  const inspectedAccumulatedData = React.useMemo(
    () => (Array.isArray(btAccumulatedByPole) ? btAccumulatedByPole.find((d) => d.poleId === selectedPoleId) : null) || null,
    [btAccumulatedByPole, selectedPoleId],
  );

  return {
    isBimInspectorOpen,
    setIsBimInspectorOpen,
    inspectedPole,
    inspectedTransformer,
    inspectedAccumulatedData,
  };
}
