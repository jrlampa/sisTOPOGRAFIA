/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from "react";
import type {
  BtTopology,
  BtPoleNode,
  BtTransformer,
  BtEdge,
  BtPoleSpec,
  BtPoleConditionStatus,
  BtPoleBtStructures,
  BtTransformerReading,
  BtRamalEntry,
  AppLocale,
  BtProjectType,
  BtNetworkScenario,
  MtTopology,
} from "../../types";
import type {
  BtPoleAccumulatedDemand,
  BtDerivedSummary,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../../services/btDerivedService";

interface BtTopologyContextType {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  projectType: BtProjectType;
  clandestinoAreaM2: number;
  mtTopology: MtTopology;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  transformerDebugById: Record<
    string,
    { assignedClients: number; estimatedDemandKva: number }
  >;

  selectedPoleId: string;
  selectedPoleIds: string[];
  selectedPole: BtPoleNode | null;
  selectedTransformerId: string;
  selectedTransformer: BtTransformer | null;
  selectedEdgeId: string;
  selectedEdge: BtEdge | null;
  isCalculating: boolean;

  // Actions
  onTopologyChange: (next: BtTopology) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (poleId: string, flag: any) => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, active: boolean) => void;
  onBtRenameTransformer?: (id: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (id: string, flag: any) => void;
  onBtSetEdgeChangeFlag?: (id: string, flag: any) => void;
  onSetSelectedPoleId?: (id: string) => void;
  onSetSelectedPoleIds?: (ids: string[]) => void;
  onSetSelectedTransformerId?: (id: string) => void;
  onSetSelectedEdgeId?: (id: string) => void;
  onSelectedEdgeChange: (id: string) => void;
  onSelectedTransformerChange: (id: string) => void;

  updatePole: (
    poleId: string,
    updater: (pole: BtPoleNode) => BtPoleNode,
  ) => void;
  updateTransformer: (
    transformerId: string,
    updater: (t: BtTransformer) => BtTransformer,
  ) => void;
  updateEdge: (edgeId: string, updater: (e: BtEdge) => BtEdge) => void;

  updatePoleRamais: (poleId: string, ramais: BtPoleNode["ramais"]) => void;
  updatePoleSpec: (poleId: string, spec: BtPoleSpec | undefined) => void;
  updatePoleConditionStatus: (
    poleId: string,
    status: BtPoleConditionStatus | undefined,
  ) => void;
  updatePoleBtStructures: (
    poleId: string,
    btStructures: BtPoleBtStructures | undefined,
  ) => void;
  updatePoleGeneralNotes: (poleId: string, notes: string | undefined) => void;

  updateTransformerVerified: (transformerId: string, verified: boolean) => void;
  updateTransformerReadings: (
    transformerId: string,
    readings: BtTransformerReading[],
  ) => void;
  updateTransformerProjectPower: (
    transformerId: string,
    powerKva: number,
  ) => void;

  updateEdgeVerified: (edgeId: string, verified: boolean) => void;
  updateEdgeConductors: (edgeId: string, conductors: BtRamalEntry[]) => void;
  updateEdgeMtConductors: (edgeId: string, conductors: BtRamalEntry[]) => void;
  updateEdgeReplacementFromConductors: (
    edgeId: string,
    conductors: BtRamalEntry[],
  ) => void;
}

const BtTopologyContext = createContext<BtTopologyContextType | undefined>(
  undefined,
);

export function BtTopologyProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BtTopologyContextType;
}) {
  return (
    <BtTopologyContext.Provider value={value}>
      {children}
    </BtTopologyContext.Provider>
  );
}

export function useBtTopologyContext() {
  const context = useContext(BtTopologyContext);
  if (!context) {
    throw new Error(
      "useBtTopologyContext must be used within a BtTopologyProvider",
    );
  }
  return context;
}
