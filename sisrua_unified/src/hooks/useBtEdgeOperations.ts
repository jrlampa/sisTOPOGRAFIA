/**
 * useBtEdgeOperations.ts
 * Encapsulates all BT Edge/Conductor CRUD operations
 * Separated from useBtCrudHandlers for better SRP compliance
 *
 * Operations:
 * - Add edge via map click (two-pole connection)
 * - Delete edge
 * - Manage conductors on edges
 * - Set edge change flags (new/existing/replacement/remove)
 * - Set replacement conductors
 */

import { useState } from "react";
import { GlobalState, GeoLocation, BtEdge } from "../types";
import { ToastType } from "../components/Toast";
import {
  EMPTY_BT_TOPOLOGY,
  DEFAULT_EDGE_CONDUCTOR,
  BtEdgeChangeFlag,
  normalizeBtEdge,
  distanceMeters,
  nextSequentialId,
} from "../utils/btNormalization";
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from "../constants/magicNumbers";

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  findNearestPole: (location: GeoLocation, maxDistanceMeters?: number) => any;
};

export function useBtEdgeOperations({
  appState,
  setAppState,
  showToast,
  findNearestPole,
}: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;

  // ── UI state for edge operations ───────────────────────────────────────────
  const [pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId] = useState<
    string | null
  >(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const clearPendingBtEdge = () => setPendingBtEdgeStartPoleId(null);

  const handleBtMapClickAddEdge = (location: GeoLocation) => {
    const nearestPole = findNearestPole(location);
    if (!nearestPole) {
      showToast("Nenhum poste próximo (raio de captura: 80m)", "error");
      return;
    }

    if (!pendingBtEdgeStartPoleId) {
      setPendingBtEdgeStartPoleId(nearestPole.id);
      showToast(`Origem selecionada: ${nearestPole.title}`, "info");
      return;
    }

    if (pendingBtEdgeStartPoleId === nearestPole.id) {
      showToast("Selecione um segundo poste para concluir o condutor", "info");
      return;
    }

    const fromPole = btTopology.poles.find(
      (pole) => pole.id === pendingBtEdgeStartPoleId,
    );
    if (!fromPole) {
      setPendingBtEdgeStartPoleId(null);
      showToast("Poste de origem não encontrado", "error");
      return;
    }

    const alreadyConnected = btTopology.edges.some(
      (edge) =>
        (edge.fromPoleId === fromPole.id && edge.toPoleId === nearestPole.id) ||
        (edge.fromPoleId === nearestPole.id && edge.toPoleId === fromPole.id),
    );

    if (alreadyConnected) {
      setPendingBtEdgeStartPoleId(nearestPole.id);
      showToast(
        `Já existe condutor entre ${fromPole.id} <-> ${nearestPole.id}. Nova origem: ${nearestPole.id}`,
        "info",
      );
      return;
    }

    const edgeId = nextSequentialId(
      btTopology.edges.map((edge) => edge.id),
      "E",
    );
    const lengthMeters = Math.round(
      distanceMeters(
        { lat: fromPole.lat, lng: fromPole.lng },
        { lat: nearestPole.lat, lng: nearestPole.lng },
      ),
    );

    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          edges: [
            ...prev.btTopology.edges,
            {
              id: edgeId,
              fromPoleId: fromPole.id,
              toPoleId: nearestPole.id,
              lengthMeters,
              conductors: [],
              replacementFromConductors: [],
              removeOnExecution: false,
              edgeChangeFlag: "existing",
            },
          ],
        },
      }),
      true,
    );

    setPendingBtEdgeStartPoleId(nearestPole.id);
    showToast(
      `Condutor ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`,
      "success",
    );
  };

  const handleBtDeleteEdge = (edgeId: string) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          edges: prev.btTopology.edges.filter((e) => e.id !== edgeId),
        },
      }),
      true,
    );
    showToast(`Condutor ${edgeId} removido`, "info");
  };

  const handleBtSetEdgeChangeFlag = (
    edgeId: string,
    edgeChangeFlag: BtEdgeChangeFlag,
  ) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          edges: prev.btTopology.edges.map((edge) => {
            if (edge.id !== edgeId) {
              return edge;
            }
            return normalizeBtEdge({
              ...edge,
              edgeChangeFlag,
              removeOnExecution: edgeChangeFlag === "remove",
            });
          }),
        },
      }),
      true,
    );

    const statusLabel =
      edgeChangeFlag === "remove"
        ? "REMOÇÃO"
        : edgeChangeFlag === "new"
          ? "NOVO"
          : edgeChangeFlag === "replace"
            ? "SUBSTITUIÇÃO"
            : "EXISTENTE";

    showToast(`Trecho ${edgeId} marcado como ${statusLabel}.`, "info");
  };

  const handleBtToggleEdgeRemoval = (
    edgeId: string,
    removeOnExecution: boolean,
  ) => {
    handleBtSetEdgeChangeFlag(
      edgeId,
      removeOnExecution ? "remove" : "existing",
    );
  };

  const handleBtSetEdgeReplacementFromConductors = (
    edgeId: string,
    conductors: BtEdge["conductors"],
  ) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          edges: prev.btTopology.edges.map((edge) =>
            edge.id !== edgeId
              ? edge
              : normalizeBtEdge({
                  ...edge,
                  replacementFromConductors: conductors,
                }),
          ),
        },
      }),
      true,
    );
  };

  const handleBtQuickAddEdgeConductor = (
    edgeId: string,
    conductorName: string,
  ) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast("Condutor não encontrado", "error");
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    const existingIndex = conductors.findIndex(
      (entry) => entry.conductorName === selectedConductor,
    );
    if (existingIndex === -1) {
      conductors.push({
        id: `${ENTITY_ID_PREFIXES.CONDUCTOR}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`,
        quantity: 1,
        conductorName: selectedConductor,
      });
    } else {
      const target = conductors[existingIndex];
      conductors[existingIndex] = { ...target, quantity: target.quantity + 1 };
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((candidate) =>
            candidate.id === edgeId ? { ...candidate, conductors } : candidate,
          ),
        },
      },
      true,
    );
    showToast(`+1 ${selectedConductor} no trecho ${edgeId}.`, "success");
  };

  const handleBtQuickRemoveEdgeConductor = (
    edgeId: string,
    conductorName: string,
  ) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast("Condutor não encontrado", "error");
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    if (conductors.length === 0) {
      showToast(`Trecho ${edgeId} sem condutor para reduzir.`, "info");
      return;
    }

    const targetIndex = [...conductors]
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .find(({ entry }) => entry.conductorName === selectedConductor)?.index;

    if (targetIndex === undefined) {
      showToast(
        `Trecho ${edgeId} sem ${selectedConductor} para reduzir.`,
        "info",
      );
      return;
    }

    const target = conductors[targetIndex];
    if (target.quantity > 1) {
      conductors[targetIndex] = { ...target, quantity: target.quantity - 1 };
    } else {
      conductors.splice(targetIndex, 1);
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((candidate) =>
            candidate.id === edgeId ? { ...candidate, conductors } : candidate,
          ),
        },
      },
      true,
    );
    showToast(`-1 ${selectedConductor} no trecho ${edgeId}.`, "success");
  };

  const handleBtSetEdgeLengthMeters = (
    edgeId: string,
    lengthMeters: number,
  ) => {
    const sanitized = Number.isFinite(lengthMeters)
      ? Math.max(0, Number(lengthMeters.toFixed(2)))
      : 0;

    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          edges: prev.btTopology.edges.map((edge) =>
            edge.id === edgeId
              ? {
                  ...edge,
                  cqtLengthMeters: sanitized,
                }
              : edge,
          ),
        },
      }),
      true,
    );
    showToast(
      `Metragem CQT do trecho ${edgeId} atualizada para ${sanitized.toFixed(2)} m.`,
      "success",
    );
  };

  return {
    // ── UI State ───────────────────────────────────────────────────────────
    pendingBtEdgeStartPoleId,
    clearPendingBtEdge,

    // ── Handlers ───────────────────────────────────────────────────────────
    handleBtMapClickAddEdge,
    handleBtDeleteEdge,
    handleBtSetEdgeChangeFlag,
    handleBtToggleEdgeRemoval,
    handleBtSetEdgeReplacementFromConductors,
    handleBtQuickAddEdgeConductor,
    handleBtQuickRemoveEdgeConductor,
    handleBtSetEdgeLengthMeters,
  };
}
