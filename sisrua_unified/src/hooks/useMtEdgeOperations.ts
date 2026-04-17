import { useState } from "react";
import { GlobalState, GeoLocation, MtEdge } from "../types";
import { ToastType } from "../components/Toast";
import { ENTITY_ID_PREFIXES } from "../constants/magicNumbers";
import { normalizeMtEdge } from "../utils/mtNormalization";
import { haversineDistanceMeters } from "../../shared/geodesic";

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  findNearestMtPole: (location: GeoLocation, maxDistanceMeters?: number) => any;
};

export function useMtEdgeOperations({
  appState,
  setAppState,
  showToast,
  findNearestMtPole,
}: Params) {
  const mtTopology = appState.mtTopology ?? { poles: [], edges: [] };
  const [pendingMtEdgeStartPoleId, setPendingMtEdgeStartPoleId] = useState<
    string | null
  >(null);

  const clearPendingMtEdge = () => setPendingMtEdgeStartPoleId(null);

  const handleMtMapClickAddEdge = (location: GeoLocation) => {
    const nearestPole = findNearestMtPole(location);
    if (!nearestPole) {
      showToast("Nenhum poste MT próximo (raio: 15m)", "error");
      return;
    }

    if (!pendingMtEdgeStartPoleId) {
      setPendingMtEdgeStartPoleId(nearestPole.id);
      showToast(`Origem MT selecionada: ${nearestPole.title}`, "info");
      return;
    }

    if (pendingMtEdgeStartPoleId === nearestPole.id) {
      showToast("Selecione um segundo poste MT para concluir o vão", "info");
      return;
    }

    const fromPole = mtTopology.poles.find(
      (pole) => pole.id === pendingMtEdgeStartPoleId,
    );
    if (!fromPole) {
      setPendingMtEdgeStartPoleId(null);
      showToast("Poste MT de origem não encontrado", "error");
      return;
    }

    const alreadyConnected = mtTopology.edges.some(
      (edge) =>
        (edge.fromPoleId === fromPole.id && edge.toPoleId === nearestPole.id) ||
        (edge.fromPoleId === nearestPole.id && edge.toPoleId === fromPole.id),
    );

    if (alreadyConnected) {
      setPendingMtEdgeStartPoleId(nearestPole.id);
      showToast(
        `Já existe vão MT entre ${fromPole.id} <-> ${nearestPole.id}. Nova origem: ${nearestPole.id}`,
        "info",
      );
      return;
    }

    const edgeId = `${ENTITY_ID_PREFIXES.MT_EDGE}${Date.now()}`;
    const lengthMeters = Math.round(
      haversineDistanceMeters(
        { lat: fromPole.lat, lng: fromPole.lng },
        { lat: nearestPole.lat, lng: nearestPole.lng },
      ),
    );

    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          edges: [
            ...mtTopology.edges,
            {
              id: edgeId,
              fromPoleId: fromPole.id,
              toPoleId: nearestPole.id,
              lengthMeters,
              edgeChangeFlag: "existing",
              verified: false,
            },
          ],
        },
      },
      true,
    );

    setPendingMtEdgeStartPoleId(nearestPole.id);
    showToast(
      `Vão MT ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`,
      "success",
    );
  };

  const handleMtDeleteEdge = (edgeId: string) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          edges: mtTopology.edges.filter((e) => e.id !== edgeId),
        },
      },
      true,
    );
    showToast(`Vão MT ${edgeId} removido`, "info");
  };

  const handleMtSetEdgeChangeFlag = (
    edgeId: string,
    edgeChangeFlag: MtEdge["edgeChangeFlag"],
  ) => {
    setAppState(
      {
        ...appState,
        mtTopology: {
          ...mtTopology,
          edges: mtTopology.edges.map((edge) =>
            edge.id === edgeId
              ? normalizeMtEdge({ ...edge, edgeChangeFlag })
              : edge,
          ),
        },
      },
      true,
    );
  };

  return {
    pendingMtEdgeStartPoleId,
    clearPendingMtEdge,
    handleMtMapClickAddEdge,
    handleMtDeleteEdge,
    handleMtSetEdgeChangeFlag,
  };
}
