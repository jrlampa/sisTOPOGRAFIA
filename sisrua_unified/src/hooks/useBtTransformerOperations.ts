/**
 * useBtTransformerOperations.ts
 * Encapsulates all BT Transformer CRUD operations
 * Separated from useBtCrudHandlers for better SRP compliance
 *
 * Operations:
 * - Add transformer via map click (attached to nearest pole)
 * - Delete transformer
 * - Toggle transformer on/off pole
 * - Move/drag transformer (must stay attached to pole)
 * - Rename transformer
 * - Set transformer change flags
 */

import { GlobalState, GeoLocation, BtTransformer } from "../types";
import { ToastType } from "../components/Toast";
import {
  EMPTY_BT_TOPOLOGY,
  BtTransformerChangeFlag,
  normalizeBtTransformer,
  distanceMeters,
  nextSequentialId,
} from "../utils/btNormalization";

type Params = {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  showToast: (message: string, type: ToastType) => void;
  findNearestPole: (location: GeoLocation, maxDistanceMeters?: number) => any;
};

export function useBtTransformerOperations({
  appState,
  setAppState,
  showToast,
  findNearestPole,
}: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleBtMapClickAddTransformer = (location: GeoLocation) => {
    const nearestPole = findNearestPole(location);
    if (!nearestPole) {
      showToast(
        "Trafo deve ser atrelado a um poste (clique em um poste)",
        "error",
      );
      return;
    }

    const existingOnPole = btTopology.transformers.find((transformer) => {
      if (transformer.poleId) {
        return transformer.poleId === nearestPole.id;
      }
      return (
        distanceMeters(
          { lat: transformer.lat, lng: transformer.lng },
          { lat: nearestPole.lat, lng: nearestPole.lng },
        ) <= 6
      );
    });

    if (existingOnPole) {
      showToast(`${nearestPole.title} já possui transformador`, "info");
      return;
    }

    const nextId = nextSequentialId(
      btTopology.transformers.map((transformer) => transformer.id),
      "TR",
    );
    const nextTransformer: BtTransformer = {
      id: nextId,
      poleId: nearestPole.id,
      lat: nearestPole.lat,
      lng: nearestPole.lng,
      title: `Transformador ${nextId}`,
      projectPowerKva: 0,
      monthlyBillBrl: 0,
      demandKva: 0,
      demandKw: 0,
      readings: [],
      transformerChangeFlag: "existing",
    };

    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          transformers: [...prev.btTopology.transformers, nextTransformer],
        },
      }),
      true,
    );
    showToast(
      `${nextTransformer.title} inserido em ${nearestPole.title}`,
      "success",
    );
  };

  const handleBtDeleteTransformer = (transformerId: string) => {
    setAppState(
      (prev) => ({
        ...prev,
        btTopology: {
          ...prev.btTopology,
          transformers: prev.btTopology.transformers.filter(
            (t) => t.id !== transformerId,
          ),
        },
      }),
      true,
    );
    showToast(`Transformador ${transformerId} removido`, "info");
  };

  const handleBtToggleTransformerOnPole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast("Poste não encontrado", "error");
      return;
    }

    const transformersOnPole = btTopology.transformers.filter((transformer) => {
      if (transformer.poleId) {
        return transformer.poleId === poleId;
      }
      return (
        distanceMeters(
          { lat: transformer.lat, lng: transformer.lng },
          { lat: pole.lat, lng: pole.lng },
        ) <= 6
      );
    });

    if (transformersOnPole.length === 0) {
      const nextId = nextSequentialId(
        btTopology.transformers.map((transformer) => transformer.id),
        "TR",
      );
      const nextTransformer: BtTransformer = {
        id: nextId,
        poleId,
        lat: pole.lat,
        lng: pole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKva: 0,
        demandKw: 0,
        readings: [],
        transformerChangeFlag: "existing",
      };

      setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        return {
          ...prev,
          btTopology: {
            ...btTopology,
            transformers: [...btTopology.transformers, nextTransformer],
          },
        };
      },
      true,
    );
    showToast(`Transformador adicionado em ${pole.title}`, "success");
    return;
  }

    const removeIds = new Set(
      transformersOnPole.map((transformer) => transformer.id),
    );
    setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        return {
          ...prev,
          btTopology: {
            ...btTopology,
            transformers: btTopology.transformers.filter(
              (transformer) => !removeIds.has(transformer.id),
            ),
          },
        };
      },
      true,
    );
    showToast(`Transformador removido de ${pole.title}`, "success");
  };

  const handleBtDragTransformer = (
    transformerId: string,
    lat: number,
    lng: number,
  ) => {
    const nearestPole = findNearestPole({ lat, lng });
    if (!nearestPole) {
      showToast("Trafo deve permanecer atrelado a um poste", "error");
      return;
    }

    setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        return {
          ...prev,
          btTopology: {
            ...btTopology,
            transformers: btTopology.transformers.map((t) =>
              t.id === transformerId
                ? {
                    ...t,
                    poleId: nearestPole.id,
                    lat: nearestPole.lat,
                    lng: nearestPole.lng,
                  }
                : t,
            ),
          },
        };
      },
      true,
    );
  };

  const handleBtRenameTransformer = (transformerId: string, title: string) => {
    setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        return {
          ...prev,
          btTopology: {
            ...btTopology,
            transformers: btTopology.transformers.map((t) =>
              t.id === transformerId ? { ...t, title } : t,
            ),
          },
        };
      },
      true,
    );
  };

  const handleBtSetTransformerChangeFlag = (
    transformerId: string,
    transformerChangeFlag: BtTransformerChangeFlag,
  ) => {
    setAppState(
      (prev) => {
        const btTopology = prev.btTopology ?? EMPTY_BT_TOPOLOGY;
        return {
          ...prev,
          btTopology: {
            ...btTopology,
            transformers: btTopology.transformers.map((transformer) =>
              transformer.id === transformerId
                ? normalizeBtTransformer({
                    ...transformer,
                    transformerChangeFlag,
                  })
                : transformer,
            ),
          },
        };
      },
      true,
    );
  };

  return {
    // ── Handlers ───────────────────────────────────────────────────────────
    handleBtMapClickAddTransformer,
    handleBtDeleteTransformer,
    handleBtToggleTransformerOnPole,
    handleBtDragTransformer,
    handleBtRenameTransformer,
    handleBtSetTransformerChangeFlag,
  };
}
