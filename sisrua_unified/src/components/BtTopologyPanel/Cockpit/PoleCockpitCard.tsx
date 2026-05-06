import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertTriangle,
  Zap,
  Truck,
  Users,
} from "lucide-react";
import type { BtPoleNode, AppLocale } from "../../../types";
import { getFlagColor } from "../../MapSelectorStyles";
import { getBtTopologyPanelText } from "../../../i18n/btTopologyPanelText";

interface PoleCockpitCardProps {
  pole: BtPoleNode;
  mtStructures?: string[];
  locale: AppLocale;
  onRename: (id: string, title: string) => void;
  onSetFlag: (id: string, flag: any) => void;
  onUpdateSpec: (id: string, spec: any) => void;
  onUpdateAcessibilidade: (
    id: string,
    hasAccess: boolean,
    dist?: number,
  ) => void;
  mechanicalResult?: {
    resultantForceDaN: number;
    overloaded: boolean;
    resultantAngleDegrees: number;
  };
  accessibilityCost?: number;
}

const PoleCockpitCard: React.FC<PoleCockpitCardProps> = ({
  pole,
  mtStructures = [],
  locale,
  onRename,
  onSetFlag: _onSetFlag,
  onUpdateSpec,
  onUpdateAcessibilidade: _onUpdateAcessibilidade,
  mechanicalResult,
  accessibilityCost: _accessibilityCost,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const t = getBtTopologyPanelText(locale).poleVerification;
  const currentFlag = pole.nodeChangeFlag ?? "existing";

  const btStructures = Object.values(pole.btStructures || {}).filter(Boolean);
  const ramais = pole.ramais || [];

  return (
    <motion.div
      layout
      className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden mb-3 dark:bg-zinc-900/80 dark:border-white/5 sunlight:border-4 sunlight:border-black sunlight:shadow-none"
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 sunlight:border-b-4 sunlight:border-black">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow shrink-0 sunlight:rounded-none sunlight:border-2 sunlight:border-black"
          style={{ backgroundColor: getFlagColor(currentFlag, "#3b82f6") }}
        >
          <MapPin size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={pole.title}
            onChange={(e) => onRename(pole.id, e.target.value)}
            className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0 w-full leading-tight dark:text-white sunlight:text-black sunlight:font-black"
          />
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 sunlight:text-black/60">
              ID: {pole.id}
            </span>
            {mechanicalResult?.overloaded && (
              <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-0.5 dark:bg-rose-500/20 dark:text-rose-400 sunlight:bg-red-600 sunlight:text-white">
                <AlertTriangle size={8} /> {t.criticalWarning}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0 dark:hover:bg-white/5 sunlight:text-black sunlight:border-2 sunlight:border-black"
          aria-label={isExpanded ? "Recolher" : "Expandir"}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3">

              {/* ── Especificação do poste ── */}
              <section>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 dark:text-slate-500 sunlight:text-black">
                  {t.bimTitle}
                </p>
                <div className="flex items-center gap-2">
                  {/* Altura */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3rem] dark:bg-zinc-950 dark:border-white/5 sunlight:bg-white sunlight:border-2 sunlight:border-black">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5 dark:text-slate-600 sunlight:text-black">
                      {t.heightM}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="number"
                        value={pole.poleSpec?.heightM ?? ""}
                        onChange={(e) =>
                          onUpdateSpec(pole.id, {
                            ...pole.poleSpec,
                            heightM: Number(e.target.value),
                          })
                        }
                        className="bg-transparent border-none p-0 w-7 text-center text-xs font-black text-slate-800 focus:ring-0 dark:text-slate-100 sunlight:text-black"
                        placeholder="—"
                      />
                      <span className="text-[8px] text-slate-400 dark:text-slate-600 sunlight:text-black">m</span>
                    </div>
                  </div>

                  {/* Esforço */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3.5rem] dark:bg-zinc-950 dark:border-white/5 sunlight:bg-white sunlight:border-2 sunlight:border-black">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5 dark:text-slate-600 sunlight:text-black">
                      {t.effortDan}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="number"
                        value={pole.poleSpec?.nominalEffortDan ?? ""}
                        onChange={(e) =>
                          onUpdateSpec(pole.id, {
                            ...pole.poleSpec,
                            nominalEffortDan: Number(e.target.value),
                          })
                        }
                        className="bg-transparent border-none p-0 w-9 text-center text-xs font-black text-slate-800 focus:ring-0 dark:text-slate-100 sunlight:text-black"
                        placeholder="—"
                      />
                      <span className="text-[8px] text-slate-400 dark:text-slate-600 sunlight:text-black">daN</span>
                    </div>
                  </div>

                  {/* Material */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 dark:bg-zinc-950 dark:border-white/5 sunlight:bg-white sunlight:border-2 sunlight:border-black">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5 dark:text-slate-600 sunlight:text-black">
                      Material
                    </span>
                    <select
                      value={pole.poleSpec?.material ?? "CC"}
                      onChange={(e) =>
                        onUpdateSpec(pole.id, {
                          ...pole.poleSpec,
                          material: e.target.value,
                        })
                      }
                      className="bg-transparent border-none p-0 text-xs font-black text-slate-800 focus:ring-0 appearance-none cursor-pointer dark:text-slate-100 sunlight:text-black"
                    >
                      <option value="CC">CC</option>
                      <option value="DT">DT</option>
                      <option value="MAD">MAD</option>
                      <option value="FIB">FIB</option>
                      <option value="FER">FER</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Estruturas MT ── */}
              <section>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 dark:text-slate-500 sunlight:text-black">
                  Estruturas MT
                </p>
                {mtStructures.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {mtStructures.map((struct, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/40 sunlight:bg-yellow-400 sunlight:text-black sunlight:border-black sunlight:border-2"
                      >
                        {struct}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic dark:text-slate-600 sunlight:text-black/60">
                    Sem estruturas MT
                  </p>
                )}
              </section>

              {/* ── Estruturas BT ── */}
              <section>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 dark:text-slate-500 sunlight:text-black">
                  {t.structuresLabel}
                </p>
                {btStructures.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {btStructures.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/40 sunlight:bg-cyan-400 sunlight:text-black sunlight:border-black sunlight:border-2"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic dark:text-slate-600 sunlight:text-black/60">
                    Passante — sem estrutura BT
                  </p>
                )}
              </section>

              {/* ── Ramais ── */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users size={10} className="text-emerald-600 dark:text-emerald-400 sunlight:text-black" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 sunlight:text-black">
                    {t.ramaisTitle}
                  </p>
                </div>
                {ramais.length > 0 ? (
                  <div className="space-y-1">
                    {ramais.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 sunlight:text-black"
                      >
                        <span className="w-4 text-center text-slate-300 font-bold dark:text-slate-700 sunlight:text-black/40">
                          {i + 1}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 sunlight:bg-green-400 sunlight:text-black sunlight:border-black sunlight:border-2">
                          {r.quantity}× {r.ramalType || "MONO"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic dark:text-slate-600 sunlight:text-black/60">
                    {t.noRamais}
                  </p>
                )}
              </section>

            </div>

            {/* ── Rodapé: resultados de engenharia ── */}
            <div className="grid grid-cols-2 border-t border-slate-100 dark:border-white/5 sunlight:border-t-4 sunlight:border-black">
              {/* Stress Mecânico */}
              <div className="px-4 py-3 border-r border-slate-100 dark:border-white/5 sunlight:border-r-4 sunlight:border-black">
                <div className="flex items-center gap-1 mb-1">
                  <Zap
                    size={10}
                    className={
                      mechanicalResult?.overloaded
                        ? "text-rose-500"
                        : "text-slate-400"
                    }
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 sunlight:text-black">
                    Stress Mec.
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-base font-black leading-none ${
                      mechanicalResult?.overloaded
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-800 dark:text-slate-100"
                    } sunlight:text-black`}
                  >
                    {mechanicalResult?.resultantForceDaN ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold dark:text-slate-600 sunlight:text-black">
                    daN
                  </span>
                </div>
              </div>

              {/* Acessibilidade */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1 mb-1">
                  <Truck size={10} className="text-slate-400 sunlight:text-black" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 sunlight:text-black">
                    Acesso
                  </span>
                </div>
                <span
                  className={`text-sm font-bold leading-none ${
                    pole.hasVehicleAccess === false
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  } sunlight:text-black sunlight:font-black`}
                >
                  {pole.hasVehicleAccess === false
                    ? `Arraste ${pole.manualDragDistanceMeters}m`
                    : "Veículo Ok"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PoleCockpitCard;
