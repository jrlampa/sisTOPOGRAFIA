import React from "react";
import { ChevronDown } from "lucide-react";
import { getTransformerChangeFlag, formatBr } from "./BtTopologyPanelUtils";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import { useBtTopologyContext } from "./BtTopologyContext";

interface BtTopologyTransformerSubSectionProps {
  isTransformerDropdownOpen: boolean;
  setIsTransformerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const BtTopologyTransformerSubSection: React.FC<
  BtTopologyTransformerSubSectionProps
> = ({
  isTransformerDropdownOpen,
  setIsTransformerDropdownOpen,
}) => {
  const {
    locale,
    btTopology,
    btNetworkScenario,
    selectedTransformer,
    onSelectedTransformerChange: selectTransformer,
    onBtRenameTransformer,
    onBtSetTransformerChangeFlag,
    updateTransformerVerified,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale).transformerEdge;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:bg-zinc-950/20 dark:border-white/5">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {btNetworkScenario === "asis" ? t.transformerTitleAsis : t.transformerTitleProject}
      </div>
      {btTopology.transformers.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-2">
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
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 pr-8 text-xs font-black text-slate-800 focus:ring-2 focus:ring-blue-100 outline-none dark:bg-zinc-900 dark:text-slate-100 dark:border-white/5"
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
              <div className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:bg-zinc-900 dark:border-white/10 custom-scrollbar">
                {btTopology.transformers.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => {
                      selectTransformer(tr.id);
                      setIsTransformerDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors dark:text-slate-300 dark:hover:bg-blue-900/20"
                  >
                    {tr.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTransformer && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    updateTransformerVerified(
                      selectedTransformer.id,
                      !selectedTransformer.verified,
                    )
                  }
                  className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedTransformer.verified ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}
                >
                  {selectedTransformer.verified
                    ? t.btnMarkUnverified
                    : t.btnMarkVerified}
                </button>
              </div>

              {onBtSetTransformerChangeFlag && (
                <div className="grid grid-cols-2 gap-1.5">
                  {(["existing", "new", "replace", "remove"] as const).map(
                    (flag) => {
                      const isActive = getTransformerChangeFlag(selectedTransformer) === flag;
                      return (
                        <button
                          key={flag}
                          onClick={() =>
                            onBtSetTransformerChangeFlag(
                              selectedTransformer.id,
                              flag,
                            )
                          }
                          className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter border transition-all ${isActive ? "border-blue-500 bg-blue-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-400 dark:bg-zinc-900 dark:border-white/5 dark:text-slate-600"}`}
                        >
                          {flag}
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:bg-zinc-950 dark:border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400">{t.demandKva}</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
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
