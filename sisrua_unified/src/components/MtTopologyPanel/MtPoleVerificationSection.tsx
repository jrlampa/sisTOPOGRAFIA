import React from "react";
import type { AppLocale, MtPoleNode, MtPoleStructures } from "../../types";
import { MT_STRUCTURE_CATALOG } from "../../constants/mtStructureCatalog";
import { getMtTopologyPanelText } from "../../i18n/mtTopologyPanelText";

interface MtPoleVerificationSectionProps {
  locale: AppLocale;
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
  locale,
  poles,
  selectedPoleId,
  onSelectPole,
  onUpdateMtStructures,
  onToggleVerified,
  onRemovePole,
  onRenamePole,
}) => {
  const t = getMtTopologyPanelText(locale);
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
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-500">
        {t.noPoles}
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
            className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm transition-colors ${
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
              title={pole.verified ? t.verifiedLabel : t.notVerifiedLabel}
            />
            {renamingPoleId === pole.id ? (
              <input
                className="min-w-0 flex-1 rounded border border-amber-300 bg-white px-1 py-0 text-sm text-slate-800 focus:outline-none"
                value={renameValue}
                autoFocus
                maxLength={60}
                title={t.renameTitle}
                placeholder={t.renamePlaceholder}
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
                title={`${pole.title} (${t.doubleClickToRename})`}
              >
                {pole.title}
              </span>
            )}
            {pole.mtStructures &&
              Object.values(pole.mtStructures).some(
                (v) => typeof v === "string" && v.trim().length > 0,
              ) && (
                <span className="rounded bg-orange-100 px-1 py-0 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  {t.mtStructuresLabel}
                </span>
              )}
            <button
              type="button"
              className="ml-auto flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title={t.removePole}
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
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {selectedPole.title}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={selectedPole.verified ?? false}
                onChange={(e) =>
                  onToggleVerified(selectedPole.id, e.target.checked)
                }
                className="h-3 w-3 rounded accent-green-600"
              />
              {t.verifiedLabel}
            </label>
          </div>

          {/* Grid n1-n4 */}
          <div className="rounded border border-slate-300 bg-white p-2">
            <div className="mb-2 text-xs text-slate-600">
              {t.structuresTitle}
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
                  <label className="text-xs uppercase text-slate-400">
                    {slot}
                  </label>
                  <input
                    type="text"
                    list="mt-structures-datalist"
                    value={selectedPole.mtStructures?.[slot] ?? ""}
                    title={`${t.structureSlotTitle} ${slot}`}
                    placeholder={t.structureSlotPlaceholder}
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
                    className="rounded border border-slate-300 bg-white p-1.5 text-sm text-slate-800"
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
