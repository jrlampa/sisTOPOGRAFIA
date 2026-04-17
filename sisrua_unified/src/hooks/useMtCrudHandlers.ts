import { GlobalState, GeoLocation, MtTopology } from "../types";
import { ToastType } from "../components/Toast";
import { useMtPoleOperations } from "./useMtPoleOperations";
import { useMtEdgeOperations } from "./useMtEdgeOperations";
import {
  EMPTY_MT_TOPOLOGY,
  normalizeMtPoles,
  normalizeMtEdges,
} from "../utils/mtNormalization";

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useMtCrudHandlers({ appState, setAppState, showToast }: Params) {
  const poles = useMtPoleOperations({ appState, setAppState, showToast });
  const edges = useMtEdgeOperations({
    appState,
    setAppState,
    showToast,
    findNearestMtPole: poles.findNearestMtPole,
  });

  const updateMtTopology = (nextTopology: MtTopology) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...nextTopology,
          poles: normalizeMtPoles(nextTopology.poles),
          edges: normalizeMtEdges(nextTopology.edges),
        },
      },
      true,
    );
  };

  const handleMtMapClick = (location: GeoLocation) => {
    const { mtEditorMode } = appState.settings;

    if (!mtEditorMode || mtEditorMode === "none" || mtEditorMode === "mt-move-pole") {
      return;
    }

    if (mtEditorMode === "mt-add-pole") {
      poles.insertMtPoleAtLocation(location);
      return;
    }

    if (mtEditorMode === "mt-add-edge") {
      edges.handleMtMapClickAddEdge(location);
    }
  };

  return {
    ...poles,
    ...edges,
    updateMtTopology,
    handleMtMapClick,
  };
}
