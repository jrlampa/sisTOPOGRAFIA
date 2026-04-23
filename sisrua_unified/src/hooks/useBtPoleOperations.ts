/**
 * useBtPoleOperations.ts
 * Encapsulates all BT Pole CRUD operations
 * Separated from useBtCrudHandlers for better SRP compliance
 *
 * Operations:
 * - Insert pole via coordinates or map click
 * - Delete pole (with cascading transformers)
 * - Rename pole
 * - Move/drag pole
 * - Manage ramal (client) operations
 * - Toggle circuit break
 * - Set pole verification status
 * - Handle clandestino/normal classification
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
  getPolesPendingNormalClassification,
  migrateClandestinoToDefaultNormalType,
} from "../utils/btPoleProjectTypeUtils";
import { generateEntityId, ID_PREFIX } from "../utils/idGenerator";
import { fetchBtDerivedState } from "../services/btDerivedService";
import { API_BASE_URL } from "../config/api";

export type { PendingNormalClassificationPole };

type Params = {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  showToast: (message: string, type: ToastType) => void;
  onSelectedPoleChange?: (poleId: string) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBtPoleOperations({
  appState,
  setAppState,
  showToast,
  onSelectedPoleChange,
}: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings: AppSettings = appState.settings;

  // ── UI state for pole operations ──────────────────────────────────────────
  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState("");
  const [
    pendingNormalClassificationPoles,
    setPendingNormalClassificationPoles,
  ] = useState<PendingNormalClassificationPole[]>([]);
  const [clandestinoToNormalModal, setClandestinoToNormalModal] = useState<{
    poles: PendingNormalClassificationPole[];
  } | null>(null);
  const [normalToClandestinoModal, setNormalToClandestinoModal] = useState<{
    totalNormalClients: number;
  } | null>(null);
  const [normalRamalModal, setNormalRamalModal] = useState<{
    poleId: string;
    poleTitle: string;
    ramalType: string;
    quantity: number;
  } | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const findNearestPole = (
    location: GeoLocation,
    maxDistanceMeters = 80,
  ): BtPoleNode | null => {
    if (btTopology.poles.length === 0) {
      return null;
    }

    let nearest = btTopology.poles[0];
    let nearestDistance = distanceMeters(location, {
      lat: nearest.lat,
      lng: nearest.lng,
    });

    for (const pole of btTopology.poles.slice(1)) {
      const poleDistance = distanceMeters(location, {
        lat: pole.lat,
        lng: pole.lng,
      });
      if (poleDistance < nearestDistance) {
        nearest = pole;
        nearestDistance = poleDistance;
      }
    }

    return nearestDistance <= maxDistanceMeters ? nearest : null;
  };

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

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const insertBtPoleAtLocation = (location: GeoLocation) => {
    const nextId = nextSequentialId(
      btTopology.poles.map((pole) => pole.id),
      "P",
    );
    const nextPole: BtPoleNode = {
      id: nextId,
      lat: location.lat,
      lng: location.lng,
      title: `Poste ${nextId}`,
      ramais: [],
      nodeChangeFlag: "new", // Postes novos criados pelo usuário devem vir como 'new'
      // Smart Specs: herda a especificação do último poste se disponível
      poleSpec: appState.btTopology?.poles.length 
        ? appState.btTopology.poles[appState.btTopology.poles.length - 1].poleSpec 
        : undefined,
    };

    setAppState(
      (prev) => ({
        ...prev,
        center: {
          lat: location.lat,
          lng: location.lng,
          label:
            location.label ??
            `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
        },
        selectionMode: "circle",
        btTopology: { ...prev.btTopology, poles: [...prev.btTopology.poles, nextPole] },
      }),
      true,
    );

    // Sincronização Poste-Driven: seleciona o poste recém-criado
    setTimeout(() => {
      onSelectedPoleChange?.(nextId);
    }, 50);

    showToast(`${nextPole.title} inserido e selecionado`, "success");
  };

  const resolveLocationFromBackend = async (
    query: string,
  ): Promise<GeoLocation> => {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      let apiErrorMessage =
        "Formato inválido. Use: -22.9068 -43.1729 ou 23K 635806 7462003.";

      try {
        const errorPayload = (await response.json()) as {
          details?: string;
          error?: string;
          message?: string;
        };

        apiErrorMessage =
          errorPayload.details ||
          errorPayload.error ||
          errorPayload.message ||
          apiErrorMessage;
      } catch {
        // Keep fallback message when response body is not JSON.
      }

      throw new Error(apiErrorMessage);
    }

    return (await response.json()) as GeoLocation;
  };

  const handleBtInsertPoleByCoordinates = async () => {
    const query = btPoleCoordinateInput.trim();
    if (!query) {
      showToast("Informe as coordenadas do poste.", "info");
      return;
    }

    try {
      const resolvedLocation = await resolveLocationFromBackend(query);
      insertBtPoleAtLocation(resolvedLocation);
      setBtPoleCoordinateInput("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Formato inválido. Use: -22.9068 -43.1729 ou 23K 635806 7462003.";
      showToast(message, "error");
    }
  };

  const handleBtDeletePole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    const transformerIdsToRemove = new Set(
      btTopology.transformers
        .filter((transformer) => {
          if (transformer.poleId) {
            return transformer.poleId === poleId;
          }
          if (!pole) {
            return false;
          }
          return (
            distanceMeters(
              { lat: transformer.lat, lng: transformer.lng },
              { lat: pole.lat, lng: pole.lng },
            ) <= 6
          );
        })
        .map((transformer) => transformer.id),
    );

    setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        const nextBtTopology = {
          ...btTopology,
          poles: prev.btTopology.poles.filter((p) => p.id !== poleId),
          edges: prev.btTopology.edges.filter(
            (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
          ),
          transformers: prev.btTopology.transformers.filter((transformer) => {
            if (transformer.poleId) return transformer.poleId !== poleId;
            const p = prev.btTopology.poles.find((p) => p.id === poleId);
            if (!p) return true;
            return (
              distanceMeters(
                { lat: transformer.lat, lng: transformer.lng },
                { lat: p.lat, lng: p.lng },
              ) > 6
            );
          }),
        };

        const nextMtTopology = {
          ...prev.mtTopology,
          poles: prev.mtTopology.poles.filter((p) => p.id !== poleId),
          edges: prev.mtTopology.edges.filter(
            (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
          ),
        };

        return {
          ...prev,
          btTopology: nextBtTopology,
          mtTopology: nextMtTopology,
        };
      },
      true,
    );
    showToast(`Poste ${poleId} removido globalmente (BT/MT)`, "info");
  };

  const handleBtSetPoleChangeFlag = (
    poleId: string,
    nodeChangeFlag: BtPoleChangeFlag,
  ) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((pole) =>
            pole.id === poleId
              ? normalizeBtPole({ ...pole, nodeChangeFlag })
              : pole,
          ),
        },
      }),
      true,
    );
  };

  const handleBtTogglePoleCircuitBreak = async (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => {
    const nextTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId
          ? normalizeBtPole({ ...pole, circuitBreakPoint })
          : pole,
      ),
    };

    // Commit the topology change immediately so the UI reflects it.
    setAppState((prev) => ({ ...prev, btTopology: nextTopology }), true);

    if (!circuitBreakPoint) {
      showToast(`Separação física removida do poste ${poleId}.`, "info");
      return;
    }

    // Compute sectioning impact for the new topology via the backend.
    try {
      const derived = await fetchBtDerivedState({
        topology: nextTopology,
        projectType: settings.projectType ?? "ramais",
        clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
      });
      const sectioningImpact = derived.sectioningImpact;
      const suggestedPole = sectioningImpact?.suggestedPoleId
        ? nextTopology.poles.find(
            (pole) => pole.id === sectioningImpact.suggestedPoleId,
          )
        : null;

      if (suggestedPole) {
        setAppState(
          (prev) => ({
            ...prev,
            center: {
              lat: suggestedPole.lat,
              lng: suggestedPole.lng,
              label: `Poste sugerido para novo trafo: ${suggestedPole.title}`,
            },
            btTopology: nextTopology,
          }),
          true,
        );
      }

      if (sectioningImpact && sectioningImpact.unservedPoleIds.length > 0) {
        const suggestedLabel = suggestedPole
          ? `${suggestedPole.title} (${suggestedPole.id})`
          : "não encontrado";
        const estimatedDemandKva =
          sectioningImpact.estimatedDemandKva ??
          sectioningImpact.estimatedDemandKw ??
          0;
        showToast(
          `Seccionamento BT: ${sectioningImpact.unservedPoleIds.length} poste(s) sem trafo atendendo. ` +
            `Carga sobrante estimada: ${estimatedDemandKva.toFixed(2)} kVA para ${sectioningImpact.unservedClients} cliente(s). ` +
            `Poste sugerido: ${suggestedLabel}.`,
          "error",
        );
        return;
      }
    } catch {
      // Backend unavailable — proceed without impact analysis.
    }

    showToast(
      `Poste ${poleId} marcado com separação física do circuito.`,
      "info",
    );
  };

  const handleBtDragPole = (poleId: string, lat: number, lng: number) => {
    const updatedPoles = btTopology.poles.map((p) =>
      p.id === poleId ? { ...p, lat, lng } : p,
    );
    const updatedTransformers = btTopology.transformers.map((transformer) =>
      transformer.poleId === poleId
        ? { ...transformer, lat, lng }
        : transformer,
    );
    const updatedEdges = btTopology.edges.map((edge) => {
      const from = updatedPoles.find((p) => p.id === edge.fromPoleId);
      const to = updatedPoles.find((p) => p.id === edge.toPoleId);
      if (!from || !to) return edge;
      const newLength = Math.round(
        distanceMeters(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ),
      );
      return { ...edge, lengthMeters: newLength };
    });

    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: updatedPoles,
          transformers: updatedTransformers,
          edges: updatedEdges,
        },
      }),
      true,
    );
  };

  const handleBtRenamePole = (poleId: string, title: string) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((p) =>
            p.id === poleId ? { ...p, title } : p,
          ),
        },
      }),
      true,
    );
  };

  const handleBtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((pole) =>
            pole.id === poleId ? { ...pole, verified } : pole,
          ),
        },
      }),
      true,
    );
  };

  const handleBtQuickAddPoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast("Poste não encontrado", "error");
      return;
    }

    if ((settings.projectType ?? "ramais") !== "clandestino") {
      setNormalRamalModal({
        poleId,
        poleTitle: pole.title,
        ramalType: NORMAL_CLIENT_RAMAL_TYPES[0],
        quantity: 1,
      });
      return;
    }

    const nextRamalId = generateEntityId(ID_PREFIX.RAMAL_POLE);
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((candidate) =>
            candidate.id === poleId
              ? {
                  ...candidate,
                  ramais: [
                    ...(candidate.ramais ?? []),
                    {
                      id: nextRamalId,
                      quantity: 1,
                      ramalType: CLANDESTINO_RAMAL_TYPE,
                    },
                  ],
                }
              : candidate,
          ),
        },
      }),
      true,
    );
    showToast(`+1 ramal em ${pole.title}.`, "success");
  };

  const handleBtQuickRemovePoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast("Poste não encontrado", "error");
      return;
    }

    const ramais = [...(pole.ramais ?? [])];
    if (ramais.length === 0) {
      showToast(`${pole.title} sem ramais para reduzir.`, "info");
      return;
    }

    const isClandestinoMode =
      (settings.projectType ?? "ramais") === "clandestino";
    const targetIndex = [...ramais]
      .map((ramal, index) => ({ ramal, index }))
      .reverse()
      .find(({ ramal }) => {
        const isClandestinoRamal =
          (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) ===
          CLANDESTINO_RAMAL_TYPE;
        return isClandestinoMode ? isClandestinoRamal : !isClandestinoRamal;
      })?.index;

    if (targetIndex === undefined) {
      showToast(
        isClandestinoMode
          ? `${pole.title} não possui ramais clandestinos para reduzir.`
          : `${pole.title} não possui ramais normais para reduzir.`,
        "info",
      );
      return;
    }

    const targetRamal = ramais[targetIndex];
    if (targetRamal.quantity > 1) {
      ramais[targetIndex] = {
        ...targetRamal,
        quantity: targetRamal.quantity - 1,
      };
    } else {
      ramais.splice(targetIndex, 1);
    }

    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((candidate) =>
            candidate.id === poleId ? { ...candidate, ramais } : candidate,
          ),
        },
      }),
      true,
    );
    showToast(`-1 ramal em ${pole.title}.`, "success");
  };

  const handleConfirmNormalRamalModal = () => {
    if (!normalRamalModal) {
      return;
    }

    const quantity = Math.max(1, Math.round(normalRamalModal.quantity));
    const nextRamalId = generateEntityId(ID_PREFIX.RAMAL_POLE);
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          poles: prev.btTopology.poles.map((candidate) =>
            candidate.id === normalRamalModal.poleId
              ? {
                  ...candidate,
                  ramais: [
                    ...(candidate.ramais ?? []),
                    {
                      id: nextRamalId,
                      quantity,
                      ramalType: normalRamalModal.ramalType,
                    },
                  ],
                }
              : candidate,
          ),
        },
      }),
      true,
    );

    setPendingNormalClassificationPoles((current) =>
      current.filter((entry) => entry.poleId !== normalRamalModal.poleId),
    );

    showToast(
      `${quantity} ramal(is) ${normalRamalModal.ramalType} em ${normalRamalModal.poleTitle}.`,
      "success",
    );
    setNormalRamalModal(null);
  };

  const onProjectTypeChange = (nextProjectType: BtProjectType) => {
    const currentProjectType = settings.projectType ?? "ramais";
    if (currentProjectType === nextProjectType) {
      return;
    }

    if (currentProjectType === "clandestino" && nextProjectType === "ramais") {
      const pendingPoles = getPolesPendingNormalClassification(btTopology);
      if (pendingPoles.length > 0) {
        setClandestinoToNormalModal({ poles: pendingPoles });
        return;
      }
    }

    if (currentProjectType === "ramais" && nextProjectType === "clandestino") {
      const totalNormalClients = btTopology.poles.reduce(
        (acc, pole) => acc + getPoleNormalClients(pole),
        0,
      );
      if (totalNormalClients > 0) {
        setNormalToClandestinoModal({ totalNormalClients });
        return;
      }
    }

    setPendingNormalClassificationPoles([]);
    setAppState(
      (prev) => ({ ...prev, settings: { ...prev.settings, projectType: nextProjectType } }),
      true,
    );
  };

  const handleClandestinoToNormalClassifyLater = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    setPendingNormalClassificationPoles(clandestinoToNormalModal.poles);
    applyProjectTypeSwitch("ramais");
    setClandestinoToNormalModal(null);
    showToast(
      "Projeto mudou para Normal. Classificação de ramais pendente (DXF bloqueado).",
      "info",
    );
  };

  const handleClandestinoToNormalConvertNow = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    const migratedTopology = migrateClandestinoToDefaultNormalType(
      btTopology,
      NORMAL_CLIENT_RAMAL_TYPES[0],
    );
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("ramais", migratedTopology);
    setClandestinoToNormalModal(null);
    showToast("Ramais clandestinos migrados para Ramal Monofasico.", "success");
  };

  const handleNormalToClandestinoKeepClients = () => {
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("clandestino");
    setNormalToClandestinoModal(null);
    showToast(
      "Mudança para Clandestino mantendo clientes normais para possível retorno.",
      "info",
    );
  };

  const handleNormalToClandestinoZeroNormalClients = () => {
    const cleanedTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) => ({
        ...pole,
        ramais: (pole.ramais ?? []).filter(
          (ramal) =>
            (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) ===
            CLANDESTINO_RAMAL_TYPE,
        ),
      })),
    };

    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("clandestino", cleanedTopology);
    setNormalToClandestinoModal(null);
    showToast(
      "Clientes normais zerados. Apenas ramais clandestinos foram mantidos.",
      "success",
    );
  };

  return {
    // ── UI State ───────────────────────────────────────────────────────────
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

    // ── Handlers ───────────────────────────────────────────────────────────
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

    // ── Helpers ────────────────────────────────────────────────────────────
    getPoleClandestinoClients,
    getPoleNormalClients,
    insertBtPoleAtLocation,
  };
}
