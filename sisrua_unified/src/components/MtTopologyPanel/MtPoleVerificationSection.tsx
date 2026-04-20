import React from "react";
import type { MtPoleNode, MtPoleStructures } from "../../types";
import { MT_STRUCTURE_CATALOG } from "../../constants/mtStructureCatalog";

interface MtPoleVerificationSectionProps {
  poles: MtPoleNode[];
  selectedPoleId: string | null;
  onSelectPole: (poleId: string) => void;
  onUpdateMtStructures: (
    poleId: string,
    mtStructures: MtPoleStructures | undefined,
  ) => void;
  onToggleVerified: (poleId: string, verified: boolean) => void;
  onRemovePole: (poleId: string) => void;
  onRenamePole: (poleId: string, title: string) => void;
}

const MtPoleVerificationSection: React.FC<MtPoleVerificationSectionProps> = ({
  poles,
  selectedPoleId,
  onSelectPole,
  onUpdateMtStructures,
  onToggleVerified,
  onRemovePole,
  onRenamePole,
}) => {
  const [renamingPoleId, setRenamingPoleId] = React.useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = React.useState("");

  const selectedPole = poles.find((p) => p.id === selectedPoleId) ?? null;

  const handleRenameStart = (pole: MtPoleNode) => {
    setRenamingPoleId(pole.id);
    setRenameValue(pole.title);
  };

  const handleRenameCommit = (poleId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0) {
      onRenamePole(poleId, trimmed);
    }
    setRenamingPoleId(null);
  };

  if (poles.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[11px] text-slate-500">
        Nenhum poste com MT cadastrado. Use o botão &quot;+ Poste&quot; acima.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Lista de postes */}
      <div className="flex flex-col gap-1">
        {poles.map((pole) => (
          <div
            key={pole.id}
            className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-[11px] transition-colors ${
              pole.id === selectedPoleId
                ? "border-amber-400 bg-amber-50 font-semibold text-amber-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => onSelectPole(pole.id)}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                pole.verified ? "bg-green-500" : "bg-slate-300"
              }`}
              title={pole.verified ? "Verificado" : "Não verificado"}
            />
            {renamingPoleId === pole.id ? (
              <input
                className="min-w-0 flex-1 rounded border border-amber-300 bg-white px-1 py-0 text-[11px] text-slate-800 focus:outline-none"
                value={renameValue}
                autoFocus
                maxLength={60}
                title="Renomear poste"
                placeholder="Nome do poste"
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameCommit(pole.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameCommit(pole.id);
                  if (e.key === "Escape") setRenamingPoleId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart(pole);
                }}
                title={`${pole.title} (duplo clique para renomear)`}
              >
                {pole.title}
              </span>
            )}
            {pole.mtStructures &&
              Object.values(pole.mtStructures).some(
                (v) => typeof v === "string" && v.trim().length > 0,
              ) && (
                <span className="rounded bg-orange-100 px-1 py-0 text-[9px] font-semibold uppercase tracking-wide text-orange-700">
                  n1-n4
                </span>
              )}
            <button
              type="button"
              className="ml-auto flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Remover poste"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePole(pole.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Painel de edição do poste selecionado */}
      {selectedPole && (
        <div className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {selectedPole.title}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-600">
              <input
                type="checkbox"
                checked={selectedPole.verified ?? false}
                onChange={(e) =>
                  onToggleVerified(selectedPole.id, e.target.checked)
                }
                className="h-3 w-3 rounded accent-green-600"
              />
              Verificado
            </label>
          </div>

          {/* Grid n1-n4 */}
          <div className="rounded border border-slate-300 bg-white p-2">
            <div className="mb-2 text-[10px] text-slate-600">
              Estruturas MT (n1-n4)
            </div>

            {/* Datalist compartilhado — exibe código + descrição curta */}
            <datalist id="mt-structures-datalist">
              {MT_STRUCTURE_CATALOG.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-2">
              {(["n1", "n2", "n3", "n4"] as const).map((slot) => (
                <div key={slot} className="flex flex-col gap-0.5">
                  <label className="text-[9px] uppercase text-slate-400">
                    {slot}
                  </label>
                  <input
                    type="text"
                    list="mt-structures-datalist"
                    value={selectedPole.mtStructures?.[slot] ?? ""}
                    title={`Estrutura MT ${slot}`}
                    placeholder={`ex: 13N1, 13CE2…`}
                    maxLength={120}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      const nextStructures: MtPoleStructures = {
                        ...selectedPole.mtStructures,
                        [slot]:
                          nextValue.trim().length > 0 ? nextValue : undefined,
                      };
                      const hasAny = Object.values(nextStructures).some(
                        (v) => typeof v === "string" && v.trim().length > 0,
                      );
                      onUpdateMtStructures(
                        selectedPole.id,
                        hasAny ? nextStructures : undefined,
                      );
                    }}
                    className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MtPoleVerificationSection;
