import { GlobalState, GeoLocation, MtPoleNode } from "../types";
import { ToastType } from "../components/Toast";
import { ENTITY_ID_PREFIXES } from "../constants/magicNumbers";
import { normalizeMtPoles } from "../utils/mtNormalization";
import { mergeMtTopologyWithBtPoles } from "../utils/mtTopologyBridge";
import { haversineDistanceMeters } from "../../shared/geodesic";

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useMtPoleOperations({
  appState,
  setAppState,
  showToast,
}: Params) {
  const mtTopology = mergeMtTopologyWithBtPoles(
    appState.btTopology,
    appState.mtTopology,
  );
  const hasBtPoles = (appState.btTopology?.poles.length ?? 0) > 0;

  const findNearestMtPole = (location: GeoLocation, maxDistanceM = 15) => {
    let nearest: MtPoleNode | null = null;
    let minDist = maxDistanceM;

    for (const pole of mtTopology.poles) {
      const dist = haversineDistanceMeters(location, pole);
      if (dist < minDist) {
        minDist = dist;
        nearest = pole;
      }
    }
    return nearest;
  };

  const insertMtPoleAtLocation = (location: GeoLocation) => {
    if (hasBtPoles) {
      const nearestSharedPole = findNearestMtPole(location);
      if (nearestSharedPole) {
        showToast(
          `MT e BT usam o mesmo poste. Poste selecionado: ${nearestSharedPole.title}`,
          "info",
        );
        return nearestSharedPole.id;
      }

      showToast(
        "Não existe poste exclusivo de MT: selecione um poste existente (BT/compartilhado) no mapa.",
        "info",
      );
      return null;
    }

    const newId = `${ENTITY_ID_PREFIXES.MT_POLE}${Date.now()}`;
    const newPole: MtPoleNode = {
      id: newId,
      lat: location.lat,
      lng: location.lng,
      title: `P-${mtTopology.poles.length + 1}`,
      verified: false,
    };

    setAppState(
      (prev) => ({
        ...prev,
        mtTopology: {
          ...prev.mtTopology,
          poles: normalizeMtPoles([...prev.mtTopology.poles, newPole]),
        },
      }),
      true,
    );
    return newId;
  };

  const handleMtDeletePole = (poleId: string) => {
    setAppState(
      (prev) => {
        const nextMtTopology = {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.filter((p) => p.id !== poleId),
          edges: prev.mtTopology.edges.filter(
            (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
          ),
        };

        // Unified deletion: if it exists in BT, clean it up there too
        const isShared = prev.btTopology?.poles.some((p) => p.id === poleId);
        
        if (!isShared) {
          return { ...prev, mtTopology: nextMtTopology };
        }

        const nextBtTopology = {
          ...prev.btTopology,
          poles: prev.btTopology.poles.filter((p) => p.id !== poleId),
          edges: prev.btTopology.edges.filter(
            (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
          ),
          transformers: prev.btTopology.transformers.filter(
            (t) => {
                if (t.poleId) return t.poleId !== poleId;
                const p = prev.btTopology.poles.find(cand => cand.id === poleId);
                if (!p) return true;
                // Cascading removal for transformers near the deleted pole
                return haversineDistanceMeters(t, p) > 6;
            }
          ),
        };

        return {
          ...prev,
          mtTopology: nextMtTopology,
          btTopology: nextBtTopology,
        };
      },
      true,
    );
    showToast(`Poste ${poleId} removido globalmente (BT/MT)`, "info");
  };

  const handleMtRenamePole = (poleId: string, title: string) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: prev.btTopology
          ? {
              ...prev.btTopology,
              poles: prev.btTopology.poles.map((p) =>
                p.id === poleId ? { ...p, title } : p,
              ),
            }
          : prev.btTopology,
        mtTopology: {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, title } : p,
          ),
        },
      }),
      true,
    );
  };

  const handleMtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState(
      (prev) => ({
        ...prev,
        mtTopology: {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, verified } : p,
          ),
        },
      }),
      true,
    );
  };

  const handleMtDragPole = (poleId: string, lat: number, lng: number) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: prev.btTopology
          ? {
              ...prev.btTopology,
              poles: prev.btTopology.poles.map((p) =>
                p.id === poleId ? { ...p, lat, lng } : p,
              ),
            }
          : prev.btTopology,
        mtTopology: {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, lat, lng } : p,
          ),
        },
      }),
      true,
    );
  };

  const handleMtSetPoleChangeFlag = (
    poleId: string,
    nodeChangeFlag: MtPoleNode["nodeChangeFlag"],
  ) => {
    setAppState(
      (prev) => ({
        ...prev,
        mtTopology: {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, nodeChangeFlag } : p,
          ),
        },
      }),
      true,
    );
  };

  return {
    findNearestMtPole,
    insertMtPoleAtLocation,
    handleMtDeletePole,
    handleMtRenamePole,
    handleMtSetPoleVerified,
    handleMtDragPole,
    handleMtSetPoleChangeFlag,
  };
}
