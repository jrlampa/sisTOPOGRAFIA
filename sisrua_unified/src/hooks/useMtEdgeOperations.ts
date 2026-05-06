import { useState } from "react";
import { BtRamalEntry, GlobalState, GeoLocation, MtEdge } from "../types";
import { ToastType } from "../components/Toast";
import { ENTITY_ID_PREFIXES } from "../constants/magicNumbers";
import { normalizeMtEdge, EMPTY_MT_TOPOLOGY } from "../utils/mtNormalization";
import { EMPTY_BT_TOPOLOGY } from "../utils/btNormalization";
import { mergeMtTopologyWithBtPoles } from "../utils/mtTopologyBridge";
import { haversineDistanceMeters } from "../../shared/geodesic";

type Params = {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  showToast: (
    message: string, 
    type: ToastType,
    action?: { label: string; onClick: () => void }
  ) => void;
  findNearestMtPole: (location: GeoLocation, maxDistanceMeters?: number) => any;
  undo: () => void;
};

export function useMtEdgeOperations({
  appState,
  setAppState,
  showToast,
  findNearestMtPole,
  undo,
}: Params) {
  const mtTopology = mergeMtTopologyWithBtPoles(
    appState.btTopology,
    appState.mtTopology,
  );
  const [pendingMtEdgeStartPoleId, setPendingMtEdgeStartPoleId] = useState<
    string | null
  >(null);

  const clearPendingMtEdge = () => setPendingMtEdgeStartPoleId(null);

  const handleMtMapClickAddEdge = (location: GeoLocation) => {
    const nearestPole = findNearestMtPole(location);
    if (!nearestPole) {
      showToast("Nenhum poste com MT próximo (raio: 15m)", "error");
      return;
    }

    if (!pendingMtEdgeStartPoleId) {
      setPendingMtEdgeStartPoleId(nearestPole.id);
      showToast(`Origem MT selecionada: ${nearestPole.title}`, "info");
      return;
    }

    if (pendingMtEdgeStartPoleId === nearestPole.id) {
      showToast("Selecione um segundo poste para concluir o vão MT", "info");
      return;
    }

    const fromPole = mtTopology.poles.find(
      (pole) => pole.id === pendingMtEdgeStartPoleId,
    );
    if (!fromPole) {
      setPendingMtEdgeStartPoleId(null);
      showToast("Poste de origem do vão MT não encontrado", "error");
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
      (prev) => {
        const mtTopology = prev.mtTopology ?? EMPTY_MT_TOPOLOGY;
        return {
          ...prev,
          mtTopology: {
            ...mtTopology,
            edges: [
              ...mtTopology.edges,
              {
                id: edgeId,
                fromPoleId: fromPole.id,
                toPoleId: nearestPole.id,
                lengthMeters,
                conductors: [],
                edgeChangeFlag: "existing",
                verified: false,
              },
            ],
          },
        };
      },
      true,
    );

    setPendingMtEdgeStartPoleId(nearestPole.id);
    showToast(
      `Vão MT ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`,
      "success",
      { label: "Desfazer", onClick: undo }
    );
  };

  const handleMtDeleteEdge = (edgeId: string) => {
    setAppState(
      (prev) => {
        const mtTopology = prev.mtTopology ?? EMPTY_MT_TOPOLOGY;
        return {
          ...prev,
          mtTopology: {
            ...mtTopology,
            edges: mtTopology.edges.filter((e) => e.id !== edgeId),
          },
        };
      },
      true,
    );
    showToast(`Vão MT ${edgeId} removido`, "info", {
      label: "Desfazer",
      onClick: undo,
    });
  };

  const handleMtSetEdgeChangeFlag = (
    edgeId: string,
    edgeChangeFlag: MtEdge["edgeChangeFlag"],
  ) => {
    setAppState(
      (prev) => {
        const mtTopology = prev.mtTopology ?? EMPTY_MT_TOPOLOGY;
        return {
          ...prev,
          mtTopology: {
            ...mtTopology,
            edges: mtTopology.edges.map((edge) =>
              edge.id === edgeId
                ? normalizeMtEdge({ ...edge, edgeChangeFlag })
                : edge,
            ),
          },
        };
      },
      true,
    );
  };

  const handleMtSetEdgeConductors = (
    edgeId: string,
    conductors: BtRamalEntry[],
  ) => {
    setAppState(
      (prev) => {
        const mtTopology = prev.mtTopology ?? EMPTY_MT_TOPOLOGY;
        const targetEdge = mtTopology.edges.find((edge) => edge.id === edgeId);
        if (!targetEdge) return prev;

        const nextMtEdges = mtTopology.edges.map((edge) =>
          edge.id === edgeId ? normalizeMtEdge({ ...edge, conductors }) : edge,
        );

        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        const nextBtTopology = {
          ...btTopology,
          edges: btTopology.edges.map((edge) => {
            const sameDirection =
              edge.fromPoleId === targetEdge.fromPoleId &&
              edge.toPoleId === targetEdge.toPoleId;
            const reverseDirection =
              edge.fromPoleId === targetEdge.toPoleId &&
              edge.toPoleId === targetEdge.fromPoleId;

            if (!sameDirection && !reverseDirection) {
              return edge;
            }

            return {
              ...edge,
              mtConductors: conductors,
            };
          }),
        };

        return {
          ...prev,
          btTopology: nextBtTopology,
          mtTopology: {
            ...mtTopology,
            edges: nextMtEdges,
          },
        };
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
    handleMtSetEdgeConductors,
  };
}
