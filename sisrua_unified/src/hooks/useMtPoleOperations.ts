import { GlobalState, GeoLocation, MtPoleNode } from "../types";
import { ToastType } from "../components/Toast";
import { ENTITY_ID_PREFIXES } from "../constants/magicNumbers";
import { normalizeMtPoles } from "../utils/mtNormalization";
import { haversineDistanceMeters } from "../../shared/geodesic";

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useMtPoleOperations({ appState, setAppState, showToast }: Params) {
  const mtTopology = appState.mtTopology ?? { poles: [], edges: [] };

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
    const newId = `${ENTITY_ID_PREFIXES.MT_POLE}${Date.now()}`;
    const newPole: MtPoleNode = {
      id: newId,
      lat: location.lat,
      lng: location.lng,
      title: `MT-${mtTopology.poles.length + 1}`,
      verified: false,
    };

    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: normalizeMtPoles([...mtTopology.poles, newPole]),
        },
      },
      true,
    );
    return newId;
  };

  const handleMtDeletePole = (poleId: string) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: mtTopology.poles.filter((p) => p.id !== poleId),
          edges: mtTopology.edges.filter(
            (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
          ),
        },
      },
      true,
    );
  };

  const handleMtRenamePole = (poleId: string, title: string) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, title } : p,
          ),
        },
      },
      true,
    );
  };

  const handleMtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, verified } : p,
          ),
        },
      },
      true,
    );
  };

  const handleMtDragPole = (poleId: string, lat: number, lng: number) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, lat, lng } : p,
          ),
        },
      },
      true,
    );
  };

  const handleMtSetPoleChangeFlag = (
    poleId: string,
    nodeChangeFlag: MtPoleNode["nodeChangeFlag"],
  ) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          poles: mtTopology.poles.map((p) =>
            p.id === poleId ? { ...p, nodeChangeFlag } : p,
          ),
        },
      },
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
