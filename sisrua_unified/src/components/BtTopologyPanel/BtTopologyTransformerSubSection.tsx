import React from "react";
import { ChevronDown } from "lucide-react";
import {
  BtTopology,
  BtTransformer,
  BtNetworkScenario,
  BtTransformerReading,
  AppLocale,
} from "../../types";
import { getTransformerChangeFlag, formatBr } from "./BtTopologyPanelUtils";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface BtTopologyTransformerSubSectionProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  selectedTransformer: BtTransformer | null;
  isTransformerDropdownOpen: boolean;
  setIsTransformerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectTransformer: (transformerId: string) => void;
  transformerDebugById: Record<
    string,
    { assignedClients: number; estimatedDemandKva: number }
  >;
  pointDemandKva: number;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (
    id: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  updateTransformerVerified: (id: string, v: boolean) => void;
  updateTransformerReadings: (id: string, r: BtTransformerReading[]) => void;
  updateTransformerProjectPower: (id: string, p: number) => void;
}

const BtTopologyTransformerSubSection: React.FC<
  BtTopologyTransformerSubSectionProps
> = ({
  locale,
  btTopology,
  btNetworkScenario,
  selectedTransformer,
  isTransformerDropdownOpen,
  setIsTransformerDropdownOpen,
  selectTransformer,
  transformerDebugById: _transformerDebugById,
  pointDemandKva: _pointDemandKva,
  onBtRenameTransformer,
  onBtSetTransformerChangeFlag,
  updateTransformerVerified,
  updateTransformerReadings: _updateTransformerReadings,
  updateTransformerProjectPower: _updateTransformerProjectPower,
}) => {
  const t = getBtTopologyPanelText(locale).transformerEdge;

  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {btNetworkScenario === "asis" ? t.transformerTitleAsis : t.transformerTitleProject}
      </div>
      {btTopology.transformers.length === 0 ? (
        <div className="text-xs text-slate-500 italic">
          {t.noTransformer}
        </div>
      ) : (
        <React.Fragment>
          <div className="relative">
            <input
              type="text"
              value={selectedTransformer?.title ?? ""}
              onChange={(e) =>
                selectedTransformer &&
                onBtRenameTransformer?.(selectedTransformer.id, e.target.value)
              }
              className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800"
              title={t.placeholderTransformerName}
            />
            <button
              onClick={() =>
                setIsTransformerDropdownOpen(!isTransformerDropdownOpen)
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <ChevronDown size={14} />
            </button>
            {isTransformerDropdownOpen && (
              <div className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded border border-slate-300 bg-white shadow-xl">
                {btTopology.transformers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      selectTransformer(t.id);
                      setIsTransformerDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTransformer && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    updateTransformerVerified(
                      selectedTransformer.id,
                      !selectedTransformer.verified,
                    )
                  }
                  className="rounded border border-cyan-400 px-3 py-1 text-xs text-cyan-700 hover:bg-cyan-50"
                >
                  {selectedTransformer.verified
                    ? t.btnMarkUnverified
                    : t.btnMarkVerified}
                </button>
              </div>

              {onBtSetTransformerChangeFlag && (
                <div className="flex flex-wrap gap-1">
                  {(["existing", "new", "replace", "remove"] as const).map(
                    (flag) => (
                      <button
                        key={flag}
                        onClick={() =>
                          onBtSetTransformerChangeFlag(
                            selectedTransformer.id,
                            flag,
                          )
                        }
                        className={`rounded px-2 py-1 text-xs border ${getTransformerChangeFlag(selectedTransformer) === flag ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white"}`}
                      >
                        {flag.toUpperCase()}
                      </button>
                    ),
                  )}
                </div>
              )}

              {/* Lógica de Leituras Simplificada para este componente */}
              <div className="rounded border border-slate-200 bg-white p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>{t.demandKva}</span>
                  <span className="font-bold">
                    {formatBr(selectedTransformer.demandKva ?? 0)} kVA
                  </span>
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
};

export default BtTopologyTransformerSubSection;
