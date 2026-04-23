import { GlobalState, GeoLocation, MtTopology } from "../types";
import { ToastType } from "../components/Toast";
import { useMtPoleOperations } from "./useMtPoleOperations";
import { useMtEdgeOperations } from "./useMtEdgeOperations";
import { normalizeMtPoles, normalizeMtEdges } from "../utils/mtNormalization";
import { mergeMtTopologyWithBtPoles } from "../utils/mtTopologyBridge";

type Params = {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useMtCrudHandlers({
  appState,
  setAppState,
  showToast,
}: Params) {
  const poles = useMtPoleOperations({ appState, setAppState, showToast });
  const edges = useMtEdgeOperations({
    appState,
    setAppState,
    showToast,
    findNearestMtPole: poles.findNearestMtPole,
  });

  const updateMtTopology = (nextTopology: MtTopology) => {
    const mergedTopology = mergeMtTopologyWithBtPoles(
      appState.btTopology,
      nextTopology,
    );

    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mergedTopology,
          poles: normalizeMtPoles(mergedTopology.poles),
          edges: normalizeMtEdges(mergedTopology.edges),
        },
      },
      true,
    );
  };

  const handleMtMapClick = (location: GeoLocation) => {
    const { mtEditorMode } = appState.settings;

    if (
      !mtEditorMode ||
      mtEditorMode === "none" ||
      mtEditorMode === "mt-move-pole"
    ) {
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
