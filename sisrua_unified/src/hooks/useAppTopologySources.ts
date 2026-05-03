import React from "react";
import { BtTopology } from "../types";
import { selectMapTopologyRenderSources } from "../utils/selectMapTopologyRenderSources";
import { mergeMtTopologyWithBtPoles } from "../utils/mtTopologyBridge";

export function useAppTopologySources({ appState, btTopology }: any) {
  const mtTopology = React.useMemo(
    () => mergeMtTopologyWithBtPoles(btTopology, appState.mtTopology),
    [btTopology, appState.mtTopology],
  );

  const mapRenderSources = React.useMemo(
    () =>
      selectMapTopologyRenderSources({
        canonicalTopology: appState.canonicalTopology,
        btTopology,
        mtTopology,
        btTransformers: btTopology.transformers,
      }),
    [appState.canonicalTopology, btTopology, mtTopology],
  );

  const dgTopologySource = React.useMemo<BtTopology>(() => {
    const markerTopology = mapRenderSources.btMarkerTopology;

    return {
      poles: markerTopology.poles.map((pole) => {
        const existingPole = btTopology.poles.find((item: any) => item.id === pole.id);
        return {
          ...existingPole,
          ...pole,
          ramais: pole.ramais ?? existingPole?.ramais ?? [],
        };
      }),
      transformers: markerTopology.transformers.map((transformer) => {
        const existingTransformer = btTopology.transformers.find((item: any) => item.id === transformer.id);
        return {
          ...existingTransformer,
          ...transformer,
          readings: transformer.readings ?? existingTransformer?.readings ?? [],
        };
      }),
      edges: markerTopology.edges.map((edge) => {
        const existingEdge = btTopology.edges.find((item: any) => item.id === edge.id);
        return {
          ...existingEdge,
          ...edge,
          conductors: edge.conductors ?? existingEdge?.conductors ?? [],
        };
      }),
    };
  }, [mapRenderSources.btMarkerTopology, btTopology]);

  return { mtTopology, mapRenderSources, dgTopologySource };
}
