import React from "react";
import { Copy } from "lucide-react";
import type { BtNetworkScenario, BtTopology, BtProjectType, AppLocale } from "../types";
import { getBtTopologyPanelText } from "../i18n/btTopologyPanelText";
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
import type { CriticalConfirmationConfig } from "./BtModals";

interface BtTopologyPanelProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario?: BtNetworkScenario;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
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
  pointDemandKva?: number;
  criticalPoleId?: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  selectedPoleId?: string;
  selectedEdgeId?: string;
  selectedTransformerId?: string;
  onSetSelectedPoleId?: (id: string) => void;
  onSetSelectedEdgeId?: (id: string) => void;
  onSetSelectedTransformerId?: (id: string) => void;
}

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  locale,
  btTopology,
  btNetworkScenario = "asis",
  onTopologyChange,
  onSelectedPoleChange,
  onSelectedTransformerChange,
  onSelectedEdgeChange,
  onBtRenamePole,
  onBtRenameTransformer,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtSetTransformerChangeFlag,
  onBtSetEdgeChangeFlag,
  onRequestCriticalConfirmation,
  accumulatedByPole: _accumulatedByPole,
  summary,
  clandestinoDisplay: _clandestinoDisplay,
  transformersDerived: _transformersDerived,
  transformerDebugById,
  criticalPoleId: _criticalPoleId,
  projectType,
  onProjectTypeChange,
  clandestinoAreaM2: _clandestinoAreaM2,
  onClandestinoAreaChange,
  pointDemandKva,
  selectedPoleId = "",
  selectedEdgeId = "",
  selectedTransformerId = "",
  onSetSelectedPoleId,
  onSetSelectedEdgeId,
  onSetSelectedTransformerId,
}) => {
  const [isPoleDropdownOpen, setIsPoleDropdownOpen] = React.useState(false);
  const [isTransformerDropdownOpen, setIsTransformerDropdownOpen] =
    React.useState(false);

  const bulkImport = useBtTopologyPanelBulkImport({
    btTopology,
    onTopologyChange,
    onSelectedPoleChange,
    onProjectTypeChange,
    onClandestinoAreaChange,
  });

  const t = getBtTopologyPanelText(locale);

  React.useEffect(() => {
    if (btTopology.poles.length === 0) {
      onSetSelectedPoleId?.("");
      return;
    }

    if (!btTopology.poles.some((pole) => pole.id === selectedPoleId)) {
      const nextPoleId = btTopology.poles[0].id;
      onSetSelectedPoleId?.(nextPoleId);
      onSelectedPoleChange?.(nextPoleId);
    }
  }, [btTopology.poles, selectedPoleId, onSelectedPoleChange, onSetSelectedPoleId]);

  React.useEffect(() => {
    if (btTopology.transformers.length === 0) {
      onSetSelectedTransformerId?.("");
      return;
    }

    if (!btTopology.transformers.some((t) => t.id === selectedTransformerId)) {
      const nextTransformerId = btTopology.transformers[0].id;
      onSetSelectedTransformerId?.(nextTransformerId);
      onSelectedTransformerChange?.(nextTransformerId);
    }
  }, [
    btTopology.transformers,
    selectedTransformerId,
    onSelectedTransformerChange,
    onSetSelectedTransformerId,
  ]);

  React.useEffect(() => {
    if (btTopology.edges.length === 0) {
      onSetSelectedEdgeId?.("");
      return;
    }

    if (!btTopology.edges.some((edge) => edge.id === selectedEdgeId)) {
      const nextEdgeId = btTopology.edges[0].id;
      onSetSelectedEdgeId?.(nextEdgeId);
      onSelectedEdgeChange?.(nextEdgeId);
    }
  }, [btTopology.edges, selectedEdgeId, onSelectedEdgeChange, onSetSelectedEdgeId]);

  const selectPole = (poleId: string) => {
    onSetSelectedPoleId?.(poleId);
    setIsPoleDropdownOpen(false);
    onSelectedPoleChange?.(poleId);
  };

  const selectTransformer = (transformerId: string) => {
    onSetSelectedTransformerId?.(transformerId);
    onSelectedTransformerChange?.(transformerId);
  };

  const selectEdge = (edgeId: string) => {
    onSetSelectedEdgeId?.(edgeId);
    onSelectedEdgeChange?.(edgeId);
  };

  const selectedPole =
    btTopology.poles.find((pole) => pole.id === selectedPoleId) ?? null;
  const selectedTransformer =
    btTopology.transformers.find((t) => t.id === selectedTransformerId) ?? null;
  const selectedEdge =
    btTopology.edges.find((e) => e.id === selectedEdgeId) ?? null;

  const effectivePointDemandKva =
    pointDemandKva ?? summary.transformerDemandKva;

  const updatePole = (
    poleId: string,
    updater: (pole: BtTopology["poles"][number]) => BtTopology["poles"][number],
  ) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? updater(pole) : pole,
      ),
    });
  };

  const updateTransformer = (
    transformerId: string,
    updater: (
      transformer: BtTopology["transformers"][number],
    ) => BtTopology["transformers"][number],
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId ? updater(transformer) : transformer,
      ),
    });
  };

  const updateEdge = (
    edgeId: string,
    updater: (edge: BtTopology["edges"][number]) => BtTopology["edges"][number],
  ) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? updater(edge) : edge,
      ),
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        <BtTopologyPanelStats
          locale={locale}
          poles={summary.poles}
          transformers={summary.transformers}
          edges={summary.edges}
          totalLengthMeters={summary.totalLengthMeters}
          transformerDemandKva={summary.transformerDemandKva}
        />

        <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t.projectTypeTitle}
          </div>
          <select
            className="mt-2 w-full rounded border border-slate-300 p-1.5 text-xs font-semibold text-slate-700"
            value={projectType}
            onChange={(e) =>
              onProjectTypeChange(e.target.value as BtProjectType)
            }
          >
            <option value="ramais">{t.projectTypeRamais}</option>
            <option value="clandestino">{t.projectTypeClandestino}</option>
          </select>

          <button
            onClick={() => bulkImport.setIsBulkRamalModalOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition-all"
          >
            <Copy size={14} /> {t.btnBulkImport}
          </button>
        </div>

        <BtPoleVerificationSection
          locale={locale}
          btTopology={btTopology}
          projectType={projectType}
          selectedPoleId={selectedPoleId}
          selectedPole={selectedPole}
          isPoleDropdownOpen={isPoleDropdownOpen}
          setIsPoleDropdownOpen={setIsPoleDropdownOpen}
          selectPole={selectPole}
          onBtRenamePole={onBtRenamePole}
          onBtSetPoleChangeFlag={onBtSetPoleChangeFlag}
          onBtTogglePoleCircuitBreak={onBtTogglePoleCircuitBreak}
          updatePoleVerified={(poleId, verified) =>
            updatePole(poleId, (pole) => ({ ...pole, verified }))
          }
          updatePoleRamais={(poleId, ramais) =>
            updatePole(poleId, (pole) => ({ ...pole, ramais }))
          }
          updatePoleSpec={(poleId, poleSpec) =>
            updatePole(poleId, (pole) => ({ ...pole, poleSpec }))
          }
          updatePoleBtStructures={(poleId, btStructures) =>
            updatePole(poleId, (pole) => ({ ...pole, btStructures }))
          }
          updatePoleConditionStatus={(poleId, conditionStatus) =>
            updatePole(poleId, (pole) => ({ ...pole, conditionStatus }))
          }
          updatePoleEquipmentNotes={(poleId, equipmentNotes) =>
            updatePole(poleId, (pole) => ({ ...pole, equipmentNotes }))
          }
          updatePoleGeneralNotes={(poleId, generalNotes) =>
            updatePole(poleId, (pole) => ({ ...pole, generalNotes }))
          }
        />

        <BtTransformerEdgeSection
          locale={locale}
          btTopology={btTopology}
          btNetworkScenario={btNetworkScenario}
          selectedTransformerId={selectedTransformerId}
          selectedTransformer={selectedTransformer}
          isTransformerDropdownOpen={isTransformerDropdownOpen}
          setIsTransformerDropdownOpen={setIsTransformerDropdownOpen}
          selectTransformer={selectTransformer}
          selectedEdgeId={selectedEdgeId}
          selectedEdge={selectedEdge}
          selectEdge={selectEdge}
          onTopologyChange={onTopologyChange}
          transformerDebugById={transformerDebugById}
          pointDemandKva={effectivePointDemandKva}
          updateTransformerVerified={(id, verified) =>
            updateTransformer(id, (transformer) => ({
              ...transformer,
              verified,
            }))
          }
          updateTransformerReadings={(id, readings) =>
            updateTransformer(id, (transformer) => ({
              ...transformer,
              readings,
            }))
          }
          updateTransformerProjectPower={(id, projectPowerKva) =>
            updateTransformer(id, (transformer) => ({
              ...transformer,
              projectPowerKva,
            }))
          }
          updateEdgeVerified={(id, verified) =>
            updateEdge(id, (edge) => ({ ...edge, verified }))
          }
          updateEdgeConductors={(id, conductors) =>
            updateEdge(id, (edge) => ({ ...edge, conductors }))
          }
          updateEdgeReplacementFromConductors={(
            id,
            replacementFromConductors,
          ) =>
            updateEdge(id, (edge) => ({ ...edge, replacementFromConductors }))
          }
          onBtRenameTransformer={onBtRenameTransformer}
          onBtSetTransformerChangeFlag={onBtSetTransformerChangeFlag}
          onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
          onRequestCriticalConfirmation={onRequestCriticalConfirmation}
        />
      </div>

      <BtTopologyPanelBulkImportModal
        locale={locale}
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
