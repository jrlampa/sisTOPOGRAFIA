import React from "react";
import { BtEditorMode, BtNetworkScenario } from "../types";

interface Params {
  setAppState: any;
  btTopology: any;
  setSelectedPoleIds: any;
  setSelectedPoleId: any;
  setIsCommandPaletteOpen: any;
}

export function useAppMainHandlers({
  setAppState,
  btTopology,
  setSelectedPoleIds,
  setSelectedPoleId,
  setIsCommandPaletteOpen,
}: Params) {
  const setBtEditorMode = React.useCallback(
    (mode: BtEditorMode) => {
      setAppState(
        (prev: any) => ({
          ...prev,
          settings: { ...prev.settings, btEditorMode: mode },
        }),
        true,
        `Modo Editor: ${mode}`,
      );
    },
    [setAppState],
  );

  const setBtNetworkScenario = React.useCallback(
    (scenario: BtNetworkScenario) => {
      setAppState(
        (prev: any) => ({
          ...prev,
          settings: { ...prev.settings, btNetworkScenario: scenario },
        }),
        true,
        `Cenário: ${scenario}`,
      );
    },
    [setAppState],
  );

  const handleBoxSelect = React.useCallback(
    (bounds: L.LatLngBounds) => {
      const selectedIds = btTopology.poles
        .filter((pole: any) => bounds.contains([pole.lat, pole.lng]))
        .map((pole: any) => pole.id);
      setSelectedPoleIds(selectedIds);
      if (selectedIds.length === 1) {
        setSelectedPoleId(selectedIds[0]);
      } else {
        setSelectedPoleId("");
      }
    },
    [btTopology.poles, setSelectedPoleIds, setSelectedPoleId],
  );

  // Ctrl+K for Command Palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev: any) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsCommandPaletteOpen]);

  return {
    setBtEditorMode,
    setBtNetworkScenario,
    handleBoxSelect,
  };
}
