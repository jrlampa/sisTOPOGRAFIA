import { useCallback } from "react";
import {
  BtTopology,
  BtPoleNode,
  BtTransformer,
  BtEdge,
  BtPoleRamalEntry,
  BtPoleSpec,
  BtPoleConditionStatus,
  BtPoleBtStructures,
  BtTransformerReading,
  BtRamalEntry,
} from "../types";

interface UseBtTopologyUpdatersParams {
  btTopology: BtTopology;
  onTopologyChange: (next: BtTopology) => void;
}

export function useBtTopologyUpdaters({ btTopology, onTopologyChange }: UseBtTopologyUpdatersParams) {
  const updatePole = useCallback((poleId: string, updater: (pole: BtPoleNode) => BtPoleNode) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? updater(pole) : pole,
      ),
    });
  }, [btTopology, onTopologyChange]);

  const updateTransformer = useCallback((id: string, updater: (t: BtTransformer) => BtTransformer) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((t) =>
        t.id === id ? updater(t) : t,
      ),
    });
  }, [btTopology, onTopologyChange]);

  const updateEdge = useCallback((id: string, updater: (e: BtEdge) => BtEdge) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((e) => (e.id === id ? updater(e) : e)),
    });
  }, [btTopology, onTopologyChange]);

  const updatePoleRamais = useCallback((poleId: string, ramais: BtPoleRamalEntry[]) => {
    updatePole(poleId, (pole) => ({ ...pole, ramais }));
  }, [updatePole]);

  const updatePoleSpec = useCallback((poleId: string, spec: BtPoleSpec) => {
    updatePole(poleId, (pole) => ({ ...pole, poleSpec: spec }));
  }, [updatePole]);

  const updatePoleConditionStatus = useCallback((poleId: string, status: BtPoleConditionStatus) => {
    updatePole(poleId, (pole) => ({ ...pole, conditionStatus: status }));
  }, [updatePole]);

  const updatePoleBtStructures = useCallback((poleId: string, structures: BtPoleBtStructures) => {
    updatePole(poleId, (pole) => ({ ...pole, btStructures: structures }));
  }, [updatePole]);

  const updatePoleGeneralNotes = useCallback((poleId: string, notes: string) => {
    updatePole(poleId, (pole) => ({ ...pole, generalNotes: notes }));
  }, [updatePole]);

  const updateTransformerVerified = useCallback((id: string, verified: boolean) => {
    updateTransformer(id, (transformer) => ({ ...transformer, verified }));
  }, [updateTransformer]);

  const updateTransformerReadings = useCallback((id: string, readings: BtTransformerReading[]) => {
    updateTransformer(id, (transformer) => ({ ...transformer, readings }));
  }, [updateTransformer]);

  const updateTransformerProjectPower = useCallback((id: string, power: number) => {
    updateTransformer(id, (transformer) => ({ ...transformer, projectPowerKva: power }));
  }, [updateTransformer]);

  const updateEdgeVerified = useCallback((id: string, verified: boolean) => {
    updateEdge(id, (edge) => ({ ...edge, verified }));
  }, [updateEdge]);

  const updateEdgeConductors = useCallback((id: string, conductors: BtRamalEntry[]) => {
    updateEdge(id, (edge) => ({ ...edge, conductors }));
  }, [updateEdge]);

  const updateEdgeMtConductors = useCallback((id: string, conductors: BtRamalEntry[]) => {
    updateEdge(id, (edge) => ({ ...edge, mtConductors: conductors }));
  }, [updateEdge]);

  const updateEdgeReplacementFromConductors = useCallback((id: string, conductors: BtRamalEntry[]) => {
    updateEdge(id, (edge) => ({ ...edge, replacementFromConductors: conductors }));
  }, [updateEdge]);

  return {
    updatePole,
    updateTransformer,
    updateEdge,
    updatePoleRamais,
    updatePoleSpec,
    updatePoleConditionStatus,
    updatePoleBtStructures,
    updatePoleGeneralNotes,
    updateTransformerVerified,
    updateTransformerReadings,
    updateTransformerProjectPower,
    updateEdgeVerified,
    updateEdgeConductors,
    updateEdgeMtConductors,
    updateEdgeReplacementFromConductors,
  };
}
