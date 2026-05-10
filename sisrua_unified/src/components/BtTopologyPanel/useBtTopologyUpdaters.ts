import type {
  BtTopology,
  BtPoleNode,
  BtTransformer,
  BtEdge,
  BtPoleSpec,
  BtPoleConditionStatus,
  BtPoleBtStructures,
  BtTransformerReading,
  BtRamalEntry,
} from "../../types";

interface Params {
  btTopology: BtTopology;
  onTopologyChange: (next: BtTopology) => void;
}

export function useBtTopologyUpdaters({
  btTopology,
  onTopologyChange,
}: Params) {
  const updatePole = (
    poleId: string,
    updater: (pole: BtPoleNode) => BtPoleNode,
  ) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? updater(pole) : pole,
      ),
    });
  };

  const updateTransformer = (
    transformerId: string,
    updater: (transformer: BtTransformer) => BtTransformer,
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId ? updater(transformer) : transformer,
      ),
    });
  };

  const updateEdge = (edgeId: string, updater: (edge: BtEdge) => BtEdge) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? updater(edge) : edge,
      ),
    });
  };

  const updatePoleRamais = (poleId: string, ramais: BtPoleNode["ramais"]) => {
    updatePole(poleId, (pole) => ({ ...pole, ramais }));
  };

  const updatePoleSpec = (poleId: string, spec: BtPoleSpec | undefined) => {
    updatePole(poleId, (pole) => ({ ...pole, poleSpec: spec }));
  };

  const updatePoleConditionStatus = (
    poleId: string,
    status: BtPoleConditionStatus | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, conditionStatus: status }));
  };

  const updatePoleBtStructures = (
    poleId: string,
    btStructures: BtPoleBtStructures | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, btStructures }));
  };

  const updatePoleGeneralNotes = (
    poleId: string,
    notes: string | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, generalNotes: notes }));
  };

  const updateTransformerVerified = (
    transformerId: string,
    verified: boolean,
  ) => {
    updateTransformer(transformerId, (transformer) => ({
      ...transformer,
      verified,
    }));
  };

  const updateTransformerReadings = (
    transformerId: string,
    readings: BtTransformerReading[],
  ) => {
    updateTransformer(transformerId, (transformer) => ({
      ...transformer,
      readings,
    }));
  };

  const updateTransformerProjectPower = (
    transformerId: string,
    powerKva: number,
  ) => {
    updateTransformer(transformerId, (transformer) => ({
      ...transformer,
      projectPowerKva: powerKva,
    }));
  };

  const updateEdgeVerified = (edgeId: string, verified: boolean) => {
    updateEdge(edgeId, (edge) => ({ ...edge, verified }));
  };

  const updateEdgeConductors = (edgeId: string, conductors: BtRamalEntry[]) => {
    updateEdge(edgeId, (edge) => ({ ...edge, conductors }));
  };

  const updateEdgeMtConductors = (
    edgeId: string,
    conductors: BtRamalEntry[],
  ) => {
    updateEdge(edgeId, (edge) => ({ ...edge, mtConductors: conductors }));
  };

  const updateEdgeReplacementFromConductors = (
    edgeId: string,
    conductors: BtRamalEntry[],
  ) => {
    updateEdge(edgeId, (edge) => ({
      ...edge,
      replacementFromConductors: conductors,
    }));
  };

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
