/**
 * BT Topology Context - Reduces prop drilling
 * Provides BT topology state and handlers to deeply nested components
 * without passing through intermediate components
 */
import React, { createContext, useContext } from 'react';
import type { BtTopology, BtEditorMode, BtExportSummary, BtExportHistoryEntry, BtNetworkScenario } from '../types';
import type { PendingNormalClassificationPole } from '../utils/btNormalization';

export interface BtContextValue {
  // State
  btTopology: BtTopology;
  btEditorMode: BtEditorMode;
  btNetworkScenario: BtNetworkScenario;
  btExportSummary?: BtExportSummary;
  btExportHistory: BtExportHistoryEntry[];
  pendingBtEdgeStartPoleId: string | null;
  pendingNormalClassificationPoles: PendingNormalClassificationPole[];
  btSelectedPoleId: string | null;
  btSelectedTransformerId: string | null;
  btSelectedEdgeId: string | null;
  btCriticalPoleId: string | null;
  btAccumulatedByPole: Array<{ poleId: string; accumulatedDemandKw: number }>;
  btPoleCoordinateInput: string;
  btTransformerDebugById: Record<string, { assignedClients: number; estimatedDemandKw: number }>;

  // Handlers
  updateBtTopology: (topology: BtTopology) => void;
  handleBtMapClick: (location: { lat: number; lng: number }) => void;
  handleBtDeletePole: (poleId: string) => void;
  handleBtDeleteEdge: (edgeId: string) => void;
  handleBtDeleteTransformer: (id: string) => void;
  handleBtSetEdgeChangeFlag: (edgeId: string, flag: any) => void;
  handleBtToggleTransformerOnPole: (poleId: string, transformerId: string) => void;
  handleBtQuickAddPoleRamal: (poleId: string, ramalType: string) => void;
  handleBtQuickRemovePoleRamal: (poleId: string, ramalIndex: number) => void;
  handleBtQuickAddEdgeConductor: (edgeId: string, conductorName: string) => void;
  handleBtQuickRemoveEdgeConductor: (edgeId: string, conductorIndex: number) => void;
  handleBtSetEdgeReplacementFromConductors: (edgeId: string, conductors: any[]) => void;
  handleBtRenamePole: (poleId: string, title: string) => void;
  handleBtRenameTransformer: (id: string, title: string) => void;
  handleBtSetPoleVerified: (poleId: string, verified: boolean) => void;
  handleBtSetPoleChangeFlag: (poleId: string, flag: any) => void;
  handleBtTogglePoleCircuitBreak: (poleId: string, circuitBreakPoint: boolean) => void;
  handleBtSetTransformerChangeFlag: (id: string, flag: any) => void;
  handleBtDragPole: (poleId: string, lat: number, lng: number) => void;
  handleBtDragTransformer: (id: string, lat: number, lng: number) => void;
  handleBtSelectedPoleChange: (poleId: string) => void;
  handleBtSelectedTransformerChange: (id: string) => void;
  handleBtSelectedEdgeChange: (edgeId: string) => void;
  handleBtInsertPoleByCoordinates: () => void;
  clearPendingBtEdge: () => void;
  handleResetBtTopology: () => void;
  setBtPoleCoordinateInput: (value: string) => void;
}

const BtContext = createContext<BtContextValue | undefined>(undefined);

export function useBtContext(): BtContextValue {
  const context = useContext(BtContext);
  if (!context) {
    throw new Error('useBtContext must be used within BtProvider');
  }
  return context;
}

export function BtProvider({ children, value }: { children: React.ReactNode; value: BtContextValue }) {
  return <BtContext.Provider value={value}>{children}</BtContext.Provider>;
}
