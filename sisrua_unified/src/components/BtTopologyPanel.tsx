import React from "react";
import { Copy, Plus, Map as MapIcon } from "lucide-react";
import type {
  BtEdge,
  BtNetworkScenario,
  BtTopology,
  GeoLocation,
  BtProjectType,
} from "../types";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";
import BtPoleVerificationSection from "./BtTopologyPanel/BtPoleVerificationSection";
import BtTransformerEdgeSection from "./BtTopologyPanel/BtTransformerEdgeSection";
import BtTopologyPanelStats from "./BtTopologyPanel/BtTopologyPanelStats";
import BtTopologyPanelBulkImportModal from "./BtTopologyPanel/BtTopologyPanelBulkImportModal";
import { useBtTopologyPanelBulkImport } from "./BtTopologyPanel/useBtTopologyPanelBulkImport";
import { calculateBtSummary } from "../utils/btCalculations";
import type { CriticalConfirmationConfig } from "./BtModals";

interface BtTopologyPanelProps {
  btTopology: BtTopology;
  btNetworkScenario?: BtNetworkScenario;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
  transformerDebugById: Record<
    string,
    { assignedClients: number; estimatedDemandKva: number }
  >;
  projectType: BtProjectType;
  onProjectTypeChange: (next: BtProjectType) => void;
  clandestinoAreaM2: number;
  onClandestinoAreaChange: (next: number) => void;
  onBtContextAction?: (
    action: "add-edge" | "add-transformer" | "add-pole",
    location: GeoLocation,
  ) => void;
  criticalPoleId?: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  mapCenter: GeoLocation;
}

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  btNetworkScenario = "asis",
  onTopologyChange,
  onSelectedPoleChange,
  onBtRenamePole,
  onBtRenameTransformer,
  onBtSetTransformerChangeFlag,
  onBtSetEdgeChangeFlag,
  onRequestCriticalConfirmation,
  accumulatedByPole,
  summary,
  clandestinoDisplay,
  transformersDerived,
  transformerDebugById,
  criticalPoleId,
  projectType,
  onProjectTypeChange,
  clandestinoAreaM2,
  onClandestinoAreaChange,
  onBtContextAction,
  mapCenter,
}) => {
  const [selectedTransformerId, setSelectedTransformerId] = React.useState("");
  const [selectedEdgeId, setSelectedEdgeId] = React.useState("");
  const [isTransformerDropdownOpen, setIsTransformerDropdownOpen] = React.useState(false);

  const bulkImport = useBtTopologyPanelBulkImport({
    btTopology,
    onTopologyChange,
    onSelectedPoleChange,
    onProjectTypeChange,
    onClandestinoAreaChange,
  });

  const selectedTransformer = btTopology.transformers.find(t => t.id === selectedTransformerId) || null;
  const selectedEdge = btTopology.edges.find(e => e.id === selectedEdgeId) || null;

  const summary = calculateBtSummary(btTopology);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        
        <BtTopologyPanelStats 
          poles={summary.poles}
          transformers={summary.transformers}
          edges={summary.edges}
          totalLengthMeters={summary.totalLengthMeters}
          transformerDemandKva={summary.transformerDemandKva}
        />

        <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de Projeto</div>
          <select 
            className="mt-2 w-full rounded border border-slate-300 p-1.5 text-xs font-semibold text-slate-700"
            value={projectType}
            onChange={(e) => onProjectTypeChange(e.target.value as any)}
          >
            <option value="ramais">Ramais (Padrão)</option>
            <option value="clandestino">Clandestino (Carga por Área)</option>
          </select>

          <button
            onClick={() => bulkImport.setIsBulkRamalModalOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition-all"
          >
            <Copy size={14} /> Importação em Massa
          </button>
        </div>

        <BtPoleVerificationSection 
          btTopology={btTopology}
          onTopologyChange={onTopologyChange}
          onSelectedPoleChange={onSelectedPoleChange}
          onBtRenamePole={onBtRenamePole}
        />

        <BtTransformerEdgeSection 
          btTopology={btTopology}
          btNetworkScenario={btNetworkScenario}
          selectedTransformerId={selectedTransformerId}
          selectedTransformer={selectedTransformer}
          isTransformerDropdownOpen={isTransformerDropdownOpen}
          setIsTransformerDropdownOpen={setIsTransformerDropdownOpen}
          selectTransformer={setSelectedTransformerId}
          selectedEdgeId={selectedEdgeId}
          selectedEdge={selectedEdge}
          selectEdge={setSelectedEdgeId}
          onTopologyChange={onTopologyChange}
          // ... other props
          transformerDebugById={transformerDebugById}
          pointDemandKva={summary.transformerDemandKva} // Simplified for UI
          totalNetworkLengthLabel={`${summary.totalLengthMeters.toFixed(1)} m`}
          selectedEdgeLengthLabel={selectedEdge?.lengthMeters ? `${selectedEdge.lengthMeters.toFixed(1)} m` : "-"}
          updateTransformerVerified={(id, v) => onTopologyChange({...btTopology, transformers: btTopology.transformers.map(t => t.id === id ? {...t, verified: v} : t)})}
          updateTransformerReadings={(id, r) => onTopologyChange({...btTopology, transformers: btTopology.transformers.map(t => t.id === id ? {...t, readings: r} : t)})}
          updateTransformerProjectPower={(id, p) => onTopologyChange({...btTopology, transformers: btTopology.transformers.map(t => t.id === id ? {...t, projectPowerKva: p} : t)})}
          updateEdgeVerified={(id, v) => onTopologyChange({...btTopology, edges: btTopology.edges.map(e => e.id === id ? {...e, verified: v} : e)})}
          updateEdgeCqtLengthMeters={(id, l) => onTopologyChange({...btTopology, edges: btTopology.edges.map(e => e.id === id ? {...e, cqtLengthMeters: l} : e)})}
          updateEdgeConductors={(id, c) => onTopologyChange({...btTopology, edges: btTopology.edges.map(e => e.id === id ? {...e, conductors: c} : e)})}
          updateEdgeReplacementFromConductors={(id, rc) => onTopologyChange({...btTopology, edges: btTopology.edges.map(e => e.id === id ? {...e, replacementFromConductors: rc} : e)})}
          onBtRenameTransformer={onBtRenameTransformer}
          onBtSetTransformerChangeFlag={onBtSetTransformerChangeFlag}
          onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
          onRequestCriticalConfirmation={onRequestCriticalConfirmation}
        />
      </div>

      <BtTopologyPanelBulkImportModal 
        isOpen={bulkImport.isBulkRamalModalOpen}
        onClose={() => bulkImport.setIsBulkRamalModalOpen(false)}
        bulkRamalText={bulkImport.bulkRamalText}
        setBulkRamalText={bulkImport.setBulkRamalText}
        bulkRamalFeedback={bulkImport.bulkRamalFeedback}
        bulkImportReview={bulkImport.bulkImportReview}
        onApply={bulkImport.applyBulkRamalInsert}
        onFileSelect={bulkImport.importBulkRamaisFromWorkbook}
        fileInputRef={bulkImport.bulkFileInputRef}
        onReviewNext={bulkImport.handleReviewNext}
      />
    </div>
  );
};

export default BtTopologyPanel;
