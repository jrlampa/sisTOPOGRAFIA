import React, { createContext, useContext, ReactNode } from "react";
import type { 
  BtTopology, 
  MtTopology, 
  CanonicalNetworkTopology,
  BtNetworkScenario,
  BtEditorMode,
  MtEditorMode
} from "../types";
import type { BtNetworkScenarioPayload, BtEditorModePayload } from "../types/index";

export interface TopologyContextType {
  btTopology: BtTopology;
  mtTopology: MtTopology;
  canonicalTopology?: CanonicalNetworkTopology;
  btNetworkScenario: BtNetworkScenarioPayload | null;
  btEditorMode: BtEditorModePayload;
  mtEditorMode?: MtEditorMode;
  isCalculating: boolean;
  updateBtTopology: (topology: BtTopology) => void;
  updateMtTopology: (topology: MtTopology) => void;
  setBtNetworkScenario: (scenario: BtNetworkScenarioPayload | null) => void;
  setBtEditorMode: (mode: BtEditorModePayload) => void;
}

const TopologyContext = createContext<TopologyContextType | undefined>(undefined);

export function TopologyProvider({ 
  children, 
  value 
}: { 
  children: ReactNode; 
  value: TopologyContextType 
}) {
  return (
    <TopologyContext.Provider value={value}>
      {children}
    </TopologyContext.Provider>
  );
}

export function useTopology() {
  const context = useContext(TopologyContext);
  if (context === undefined) {
    throw new Error("useTopology must be used within a TopologyProvider");
  }
  return context;
}
