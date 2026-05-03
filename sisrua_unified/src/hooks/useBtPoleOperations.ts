/**
 * useBtPoleOperations.ts
 * Encapsulates all BT Pole CRUD operations
 * Separated from useBtCrudHandlers for better SRP compliance
 */

import { useState } from "react";
import {
  GlobalState,
  GeoLocation,
  BtTopology,
  BtPoleNode,
  BtProjectType,
  AppSettings,
} from "../types";
import { ToastType } from "../components/Toast";
import {
  EMPTY_BT_TOPOLOGY,
  NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE,
  BtPoleChangeFlag,
  PendingNormalClassificationPole,
  normalizeBtPole,
  distanceMeters,
  nextSequentialId,
} from "../utils/btNormalization";
import {
  getPoleClandestinoClients,
  getPoleNormalClients,
} from "../utils/btPoleProjectTypeUtils";
import { useBtPoleClandestinoHandlers } from "./useBtPoleClandestinoHandlers";
import { generateEntityId, ID_PREFIX } from "../utils/idGenerator";
import { fetchBtDerivedState } from "../services/btDerivedService";
import { API_BASE_URL } from "../config/api";
import { applyOrthoSnap } from "../utils/smartSnapping";

export type { PendingNormalClassificationPole };

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
  onSelectedPoleChange?: (poleId: string) => void;
  undo: () => void;
};

export function useBtPoleOperations({
  appState,
  setAppState,
  showToast,
  onSelectedPoleChange,
  undo,
}: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings: AppSettings = appState.settings;

  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState("");
  const [
    pendingNormalClassificationPoles,
    setPendingNormalClassificationPoles,
  ] = useState<PendingNormalClassificationPole[]>([]);

  const applyProjectTypeSwitch = (
    nextProjectType: BtProjectType,
    nextTopology: BtTopology = btTopology,
  ) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: nextTopology,
        settings: { ...prev.settings, projectType: nextProjectType },
      }),
      true,
    );
  };

  const {
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    onProjectTypeChange,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
  } = useBtPoleClandestinoHandlers({
    btTopology,
    settings,
    setAppState,
    showToast,
    undo,
    applyProjectTypeSwitch,
    setPendingNormalClassificationPoles,
  });

  const [normalRamalModal, setNormalRamalModal] = useState<{
    poleId: string;
    poleTitle: string;
    ramalType: string;
    quantity: number;
  } | null>(null);

  const findNearestPole = (
    location: GeoLocation,
    maxDistanceMeters = 80,
  ): BtPoleNode | null => {
    if (btTopology.poles.length === 0) return null;
    let nearest = btTopology.poles[0];
    let nearestDistance = distanceMeters(location, { lat: nearest.lat, lng: nearest.lng });
    for (const pole of btTopology.poles.slice(1)) {
      const poleDistance = distanceMeters(location, { lat: pole.lat, lng: pole.lng });
      if (poleDistance < nearestDistance) {
        nearest = pole;
        nearestDistance = poleDistance;
      }
    }
    return nearestDistance <= maxDistanceMeters ? nearest : null;
  };

  const insertBtPoleAtLocation = (location: GeoLocation) => {
    const nextId = nextSequentialId(btTopology.poles.map((pole) => pole.id), "P");
    const nextPole: BtPoleNode = {
      id: nextId,
      lat: location.lat,
      lng: location.lng,
      title: `Poste ${nextId}`,
      ramais: [],
      nodeChangeFlag: "new",
      poleSpec: appState.btTopology?.poles.length
        ? appState.btTopology.poles[appState.btTopology.poles.length - 1].poleSpec
        : undefined,
      dataSource: "manual",
    };
    setAppState((prev) => ({
      ...prev,
      center: {
        lat: location.lat,
        lng: location.lng,
        label: location.label ?? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
      },
      selectionMode: "circle",
      btTopology: { ...prev.btTopology, poles: [...prev.btTopology.poles, nextPole] },
    }), true);
    setTimeout(() => onSelectedPoleChange?.(nextId), 50);
    showToast(`${nextPole.title} inserido e selecionado`, "success", { label: "Desfazer", onClick: undo });
  };

  const handleBtInsertPoleByCoordinates = async () => {
    const query = btPoleCoordinateInput.trim();
    if (!query) {
      showToast("Informe as coordenadas do poste.", "info");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Falha na busca");
      const resolvedLocation = await response.json() as GeoLocation;
      insertBtPoleAtLocation(resolvedLocation);
      setBtPoleCoordinateInput("");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro desconhecido", "error");
    }
  };

  const handleBtDeletePole = (poleId: string) => {
    setAppState((prev) => {
      const nextBtTopology = {
        ...prev.btTopology,
        poles: prev.btTopology.poles.filter((p) => p.id !== poleId),
        edges: prev.btTopology.edges.filter((e) => e.fromPoleId !== poleId && e.toPoleId !== poleId),
        transformers: prev.btTopology.transformers.filter((t) => t.poleId !== poleId),
      };
      return { ...prev, btTopology: nextBtTopology };
    }, true);
    showToast(`Poste ${poleId} removido`, "info", { label: "Desfazer", onClick: undo });
  };

  const handleBtSetPoleChangeFlag = (poleId: string, nodeChangeFlag: BtPoleChangeFlag) => {
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((pole) =>
          pole.id === poleId ? normalizeBtPole({ ...pole, nodeChangeFlag }) : pole
        ),
      },
    }), true);
  };

  const handleBtTogglePoleCircuitBreak = async (poleId: string, circuitBreakPoint: boolean) => {
    const nextTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? normalizeBtPole({ ...pole, circuitBreakPoint }) : pole
      ),
    };
    setAppState((prev) => ({ ...prev, btTopology: nextTopology }), true);
    showToast(`Circuito ${circuitBreakPoint ? "seccionado" : "unificado"} no poste ${poleId}.`, "info", { label: "Desfazer", onClick: undo });
  };

  const handleBtDragPole = (poleId: string, rawLat: number, rawLng: number) => {
    const neighbors = btTopology.edges
      .filter((e) => e.fromPoleId === poleId || e.toPoleId === poleId)
      .map((e) => btTopology.poles.find((p) => p.id === (e.fromPoleId === poleId ? e.toPoleId : e.fromPoleId)))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const { lat, lng } = applyOrthoSnap(rawLat, rawLng, neighbors);
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) => p.id === poleId ? { ...p, lat, lng } : p),
      },
    }), true);
  };

  const handleBtRenamePole = (poleId: string, title: string) => {
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) => p.id === poleId ? { ...p, title } : p),
      },
    }), true);
  };

  const handleBtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) => p.id === poleId ? { ...p, verified } : p),
      },
    }), true);
  };

  const handleBtQuickAddPoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((p) => p.id === poleId);
    if (!pole) return;
    const nextRamalId = generateEntityId(ID_PREFIX.RAMAL_POLE);
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) =>
          p.id === poleId ? { ...p, ramais: [...(p.ramais ?? []), { id: nextRamalId, quantity: 1, ramalType: CLANDESTINO_RAMAL_TYPE }] } : p
        ),
      },
    }), true);
  };

  const handleBtQuickRemovePoleRamal = (poleId: string) => {
    setAppState((prev) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) =>
          p.id === poleId ? { ...p, ramais: (p.ramais ?? []).slice(0, -1) } : p
        ),
      },
    }), true);
  };

  const handleConfirmNormalRamalModal = () => {
    if (!normalRamalModal) return;
    const { poleId, ramalType, quantity } = normalRamalModal;
    setAppState((prev: GlobalState) => ({
      ...prev,
      btTopology: {
        ...prev.btTopology,
        poles: prev.btTopology.poles.map((p) =>
          p.id === poleId
            ? {
                ...p,
                ramais: [
                  ...(p.ramais ?? []),
                  { id: generateEntityId(ID_PREFIX.RAMAL_POLE), quantity, ramalType },
                ],
              }
            : p
        ),
      },
    }), true);
    setNormalRamalModal(null);
  };

  return {
    btPoleCoordinateInput,
    setBtPoleCoordinateInput,
    pendingNormalClassificationPoles,
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    normalRamalModal,
    setNormalRamalModal,
    isSidebarDockedForRamalModal: Boolean(normalRamalModal),
    handleBtInsertPoleByCoordinates,
    handleBtDeletePole,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtDragPole,
    handleBtRenamePole,
    handleBtSetPoleVerified,
    handleBtQuickAddPoleRamal,
    handleBtQuickRemovePoleRamal,
    handleConfirmNormalRamalModal,
    onProjectTypeChange,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
    findNearestPole,
    getPoleClandestinoClients,
    getPoleNormalClients,
    insertBtPoleAtLocation,
  };
}
