import React from "react";
import { Zap } from "lucide-react";
import type {
  BtRamalEntry,
  MtPoleNode,
  MtPoleStructures,
  MtTopology,
  MtEditorMode,
  AppLocale,
} from "../types";
import MtPoleVerificationSection from "./MtTopologyPanel/MtPoleVerificationSection";
import MtEdgeVerificationSection from "./MtTopologyPanel/MtEdgeVerificationSection";
import { getMtTopologyPanelText } from "../i18n/mtTopologyPanelText";

interface MtTopologyPanelProps {
  locale: AppLocale;
  mtTopology: MtTopology;
  onTopologyChange: (next: MtTopology) => void;
  mtEditorMode?: MtEditorMode;
  hasBtPoles?: boolean;
}

const MtTopologyPanel: React.FC<MtTopologyPanelProps> = ({
  locale,
  mtTopology,
  onTopologyChange,
  hasBtPoles = false,
}) => {
  const t = getMtTopologyPanelText(locale);
  const [selectedPoleId, setSelectedPoleId] = React.useState<string | null>(
    null,
  );

  const polesById = React.useMemo(() => {
    return new Map(mtTopology.poles.map((p) => [p.id, p]));
  }, [mtTopology.poles]);

  const addPole = () => {
    if (hasBtPoles) {
      return;
    }

    const newId = `mt-${Date.now()}`;
    const newPole: MtPoleNode = {
      id: newId,
      lat: 0,
      lng: 0,
      title: `MT-${mtTopology.poles.length + 1}`,
      verified: false,
    };
    const next: MtTopology = {
      ...mtTopology,
      poles: [...mtTopology.poles, newPole],
    };
    onTopologyChange(next);
    setSelectedPoleId(newId);
  };

  const removePole = (poleId: string) => {
    onTopologyChange({
      ...mtTopology,
      poles: mtTopology.poles.filter((p) => p.id !== poleId),
      edges: mtTopology.edges.filter(
        (e) => e.fromPoleId !== poleId && e.toPoleId !== poleId,
      ),
    });
    if (selectedPoleId === poleId) {
      setSelectedPoleId(null);
    }
  };

  const removeEdge = (edgeId: string) => {
    onTopologyChange({
      ...mtTopology,
      edges: mtTopology.edges.filter((e) => e.id !== edgeId),
    });
  };

  const setEdgeChangeFlag = (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => {
    onTopologyChange({
      ...mtTopology,
      edges: mtTopology.edges.map((e) =>
        e.id === edgeId ? { ...e, edgeChangeFlag } : e,
      ),
    });
  };

  const renamePole = (poleId: string, title: string) => {
    onTopologyChange({
      ...mtTopology,
      poles: mtTopology.poles.map((p) =>
        p.id === poleId ? { ...p, title } : p,
      ),
    });
  };

  const toggleVerified = (poleId: string, verified: boolean) => {
    onTopologyChange({
      ...mtTopology,
      poles: mtTopology.poles.map((p) =>
        p.id === poleId ? { ...p, verified } : p,
      ),
    });
  };

  const updateMtStructures = (
    poleId: string,
    mtStructures: MtPoleStructures | undefined,
  ) => {
    onTopologyChange({
      ...mtTopology,
      poles: mtTopology.poles.map((p) =>
        p.id === poleId ? { ...p, mtStructures } : p,
      ),
    });
  };

  const setEdgeConductors = (edgeId: string, conductors: BtRamalEntry[]) => {
    onTopologyChange({
      ...mtTopology,
      edges: mtTopology.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, conductors } : edge,
      ),
    });
  };

  const verifiedCount = mtTopology.poles.filter((p) => p.verified).length;
  const totalPoles = mtTopology.poles.length;
  const totalEdges = mtTopology.edges.length;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Resumo da Rede MT */}
      <div className="flex items-center justify-between border-b border-orange-200/50 pb-2 dark:border-orange-900/20">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-orange-600" />
          <span className="text-xs font-black uppercase tracking-[0.15em] text-orange-900 dark:text-orange-100">
            {t.title}
          </span>
        </div>
        <div className="flex gap-2 text-xs font-bold text-slate-500">
          <span>
            {totalPoles}
            {t.polesCount}
          </span>
          <span>
            {totalEdges}
            {t.edgesCount}
          </span>
          <span className="text-orange-600">
            {verifiedCount}/{totalPoles} {t.verifiedStatus}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Seção de Postes */}
        <div className="flex flex-col gap-2">
          <MtPoleVerificationSection
            locale={locale}
            poles={mtTopology.poles}
            selectedPoleId={selectedPoleId}
            onSelectPole={setSelectedPoleId}
            onUpdateMtStructures={updateMtStructures}
            onToggleVerified={toggleVerified}
            onRemovePole={removePole}
            onRenamePole={renamePole}
          />

          {hasBtPoles ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              {t.sharedBtMessage}
            </div>
          ) : (
            <button
              type="button"
              onClick={addPole}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 py-1.5 text-xs font-black uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-400"
            >
              {t.addStructure}
            </button>
          )}
        </div>

        {/* Seção de Vãos */}
        <MtEdgeVerificationSection
          locale={locale}
          edges={mtTopology.edges}
          polesById={polesById}
          onRemoveEdge={removeEdge}
          onSetEdgeChangeFlag={setEdgeChangeFlag}
          onSetEdgeConductors={setEdgeConductors}
        />
      </div>

      {totalPoles > 0 && (
        <p className="mt-2 text-center text-xs font-medium text-slate-400">
          {t.shortcutHint}
        </p>
      )}
    </div>
  );
};

export default MtTopologyPanel;
