import React from "react";
import { Zap } from "lucide-react";
import type { MtPoleNode, MtPoleStructures, MtTopology, MtEditorMode } from "../types";
import MtPoleVerificationSection from "./MtTopologyPanel/MtPoleVerificationSection";
import MtEdgeVerificationSection from "./MtTopologyPanel/MtEdgeVerificationSection";

interface MtTopologyPanelProps {
  mtTopology: MtTopology;
  onTopologyChange: (next: MtTopology) => void;
  mtEditorMode?: MtEditorMode;
}

const MtTopologyPanel: React.FC<MtTopologyPanelProps> = ({
  mtTopology,
  onTopologyChange,
}) => {
  const [selectedPoleId, setSelectedPoleId] = React.useState<string | null>(
    null,
  );

  const polesById = React.useMemo(() => {
    return new Map(mtTopology.poles.map((p) => [p.id, p]));
  }, [mtTopology.poles]);

  const addPole = () => {
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

  const verifiedCount = mtTopology.poles.filter((p) => p.verified).length;
  const totalPoles = mtTopology.poles.length;
  const totalEdges = mtTopology.edges.length;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Resumo da Rede MT */}
      <div className="flex items-center justify-between border-b border-orange-200/50 pb-2 dark:border-orange-900/20">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-orange-600" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-900 dark:text-orange-100">
            Média Tensão
          </span>
        </div>
        <div className="flex gap-2 text-[9px] font-bold text-slate-500">
          <span>{totalPoles}P</span>
          <span>{totalEdges}V</span>
          <span className="text-orange-600">{verifiedCount}/{totalPoles} OK</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Seção de Postes */}
        <div className="flex flex-col gap-2">
          <MtPoleVerificationSection
            poles={mtTopology.poles}
            selectedPoleId={selectedPoleId}
            onSelectPole={setSelectedPoleId}
            onUpdateMtStructures={updateMtStructures}
            onToggleVerified={toggleVerified}
            onRemovePole={removePole}
            onRenamePole={renamePole}
          />

          <button
            type="button"
            onClick={addPole}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 py-1.5 text-[10px] font-black uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-400"
          >
            + Adicionar Estrutura
          </button>
        </div>

        {/* Seção de Vãos */}
        <MtEdgeVerificationSection
          edges={mtTopology.edges}
          polesById={polesById}
          onRemoveEdge={removeEdge}
          onSetEdgeChangeFlag={setEdgeChangeFlag}
        />
      </div>

      {totalPoles > 0 && (
        <p className="mt-2 text-center text-[9px] font-medium text-slate-400">
          Dica: Use <strong>SHIFT+M</strong> para alternar modo MT
        </p>
      )}
    </div>
  );
};

export default MtTopologyPanel;
