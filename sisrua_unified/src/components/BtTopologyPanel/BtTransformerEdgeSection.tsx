import React from "react";
import { BtTopology, BtNetworkScenario, BtTransformer, BtEdge, BtTransformerReading } from "../../types";
import BtTopologyTransformerSubSection from "./BtTopologyTransformerSubSection";
import BtTopologyEdgeSubSection from "./BtTopologyEdgeSubSection";
import type { CriticalConfirmationConfig } from "../BtModals";
import type { AppLocale } from "../../types";

interface BtTransformerEdgeSectionProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  selectedTransformerId: string;
  selectedTransformer: BtTransformer | null;
  isTransformerDropdownOpen: boolean;
  setIsTransformerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectTransformer: (transformerId: string) => void;
  selectedEdgeId: string;
  selectedEdge: BtEdge | null;
  selectEdge: (edgeId: string) => void;
  transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>;
  pointDemandKva: number;
  onTopologyChange: (next: BtTopology) => void;
  onBtRenameTransformer?: (id: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (id: string, flag: "existing" | "new" | "remove" | "replace") => void;
  onBtSetEdgeChangeFlag?: (id: string, flag: "existing" | "new" | "remove" | "replace") => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
  updateTransformerVerified: (id: string, v: boolean) => void;
  updateTransformerReadings: (id: string, r: BtTransformerReading[]) => void;
  updateTransformerProjectPower: (id: string, p: number) => void;
  updateEdgeVerified: (id: string, v: boolean) => void;
  updateEdgeConductors: (id: string, c: BtTopology["edges"][number]["conductors"]) => void;
  updateEdgeReplacementFromConductors: (id: string, rc: BtTopology["edges"][number]["conductors"]) => void;
}

const BtTransformerEdgeSection: React.FC<BtTransformerEdgeSectionProps> = (props) => {
  return (
    <div className="space-y-4">
      <BtTopologyTransformerSubSection 
        locale={props.locale}
        btTopology={props.btTopology}
        btNetworkScenario={props.btNetworkScenario}
        selectedTransformer={props.selectedTransformer}
        isTransformerDropdownOpen={props.isTransformerDropdownOpen}
        setIsTransformerDropdownOpen={props.setIsTransformerDropdownOpen}
        selectTransformer={props.selectTransformer}
        transformerDebugById={props.transformerDebugById}
        pointDemandKva={props.pointDemandKva}
        onBtRenameTransformer={props.onBtRenameTransformer}
        onBtSetTransformerChangeFlag={props.onBtSetTransformerChangeFlag}
        updateTransformerVerified={props.updateTransformerVerified}
        updateTransformerReadings={props.updateTransformerReadings}
        updateTransformerProjectPower={props.updateTransformerProjectPower}
      />

      <BtTopologyEdgeSubSection 
        locale={props.locale}
        btTopology={props.btTopology}
        btNetworkScenario={props.btNetworkScenario}
        selectedEdge={props.selectedEdge}
        selectedEdgeId={props.selectedEdgeId}
        selectEdge={props.selectEdge}
        updateEdgeVerified={props.updateEdgeVerified}
        updateEdgeConductors={props.updateEdgeConductors}
        updateEdgeReplacementFromConductors={props.updateEdgeReplacementFromConductors}
        onBtSetEdgeChangeFlag={props.onBtSetEdgeChangeFlag}
      />
    </div>
  );
};

export default BtTransformerEdgeSection;
