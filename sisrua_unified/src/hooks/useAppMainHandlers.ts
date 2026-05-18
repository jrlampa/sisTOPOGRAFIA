import React from 'react';
import { BtTopology, BtPoleNode } from '../types';

interface Params {
  setAppState: any;
  btTopology: BtTopology;
  setSelectedPoleIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedPoleId: React.Dispatch<React.SetStateAction<string>>;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppMainHandlers({
  setAppState,
  btTopology,
  setSelectedPoleIds,
  setSelectedPoleId,
  setIsCommandPaletteOpen,
}: Params) {
  const setBtEditorMode = React.useCallback(
    (mode: string | { mode: string }) => {
      const nextMode = typeof mode === 'string' ? mode : mode.mode;
      setAppState(
        (prev: any) => ({
          ...prev,
          btEditorMode: { mode: nextMode },
        }),
        true,
        `Editor mode: ${nextMode}`
      );
    },
    [setAppState]
  );

  const handleBoxSelect = React.useCallback(
    (bounds: L.LatLngBounds) => {
      const selectedIds = btTopology.poles
        .filter((pole: BtPoleNode) => bounds.contains([pole.lat, pole.lng]))
        .map((pole: BtPoleNode) => pole.id);
      setSelectedPoleIds(selectedIds);
      if (selectedIds.length === 1) {
        setSelectedPoleId(selectedIds[0]);
      } else {
        setSelectedPoleId('');
      }
    },
    [btTopology.poles, setSelectedPoleIds, setSelectedPoleId]
  );

  // Ctrl+K for Command Palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsCommandPaletteOpen]);

  return {
    setBtEditorMode,
    handleBoxSelect,
  };
}
