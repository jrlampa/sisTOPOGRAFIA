import React from "react";
import { Zap } from "lucide-react";
import type { MtPoleNode, MtPoleStructures, MtTopology } from "../types";
import MtPoleVerificationSection from "./MtTopologyPanel/MtPoleVerificationSection";

interface MtTopologyPanelProps {
  mtTopology: MtTopology;
  onTopologyChange: (next: MtTopology) => void;
}

const MtTopologyPanel: React.FC<MtTopologyPanelProps> = ({
  mtTopology,
  onTopologyChange,
}) => {
  const [selectedPoleId, setSelectedPoleId] = React.useState<string | null>(
    null,
  );

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
    const next: MtTopology = {
      ...mtTopology,
      poles: mtTopology.poles.filter((p) => p.id !== poleId),
    };
    onTopologyChange(next);
    if (selectedPoleId === poleId) {
      setSelectedPoleId(null);
    }
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
  const totalCount = mtTopology.poles.length;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-orange-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-orange-900">
            Topologia MT
          </span>
        </div>
        {totalCount > 0 && (
          <span className="text-[10px] text-slate-500">
            {verifiedCount}/{totalCount} verificados
          </span>
        )}
      </div>

      {/* Botão de adição */}
      <button
        type="button"
        onClick={addPole}
        className="flex w-full items-center justify-center gap-1.5 rounded border-2 border-dashed border-orange-300 bg-orange-50 py-2 text-[11px] font-semibold uppercase tracking-wide text-orange-700 transition-colors hover:border-orange-400 hover:bg-orange-100"
      >
        + Poste MT
      </button>

      {/* Seção de verificação */}
      <MtPoleVerificationSection
        poles={mtTopology.poles}
        selectedPoleId={selectedPoleId}
        onSelectPole={setSelectedPoleId}
        onUpdateMtStructures={updateMtStructures}
        onToggleVerified={toggleVerified}
        onRemovePole={removePole}
        onRenamePole={renamePole}
      />

      {/* Nota informativa */}
      {totalCount > 0 && (
        <p className="text-[10px] text-slate-400">
          Duplo clique no nome do poste para renomear.
        </p>
      )}
    </div>
  );
};

export default MtTopologyPanel;
