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
  onRename,
  onSetFlag: _onSetFlag,
  onUpdateSpec,
  onUpdateAcessibilidade: _onUpdateAcessibilidade,
  mechanicalResult,
  accessibilityCost: _accessibilityCost,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const currentFlag = pole.nodeChangeFlag ?? "existing";

  const btStructures = Object.values(pole.btStructures || {}).filter(Boolean);
  const ramais = pole.ramais || [];

  return (
    <motion.div
      layout
      className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden mb-3"
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow shrink-0"
          style={{ backgroundColor: getFlagColor(currentFlag, "#3b82f6") }}
        >
          <MapPin size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={pole.title}
            onChange={(e) => onRename(pole.id, e.target.value)}
            className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0 w-full leading-tight"
          />
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-slate-400">
              ID: {pole.id}
            </span>
            {mechanicalResult?.overloaded && (
              <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-0.5">
                <AlertTriangle size={8} /> Sobrecarga
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0"
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
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Especificação
                </p>
                <div className="flex items-center gap-2">
                  {/* Altura */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3rem]">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5">
                      Altura
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
                        className="bg-transparent border-none p-0 w-7 text-center text-xs font-black text-slate-800 focus:ring-0"
                        placeholder="—"
                      />
                      <span className="text-[8px] text-slate-400">m</span>
                    </div>
                  </div>

                  {/* Esforço */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3.5rem]">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5">
                      Esforço
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
                        className="bg-transparent border-none p-0 w-9 text-center text-xs font-black text-slate-800 focus:ring-0"
                        placeholder="—"
                      />
                      <span className="text-[8px] text-slate-400">daN</span>
                    </div>
                  </div>

                  {/* Material */}
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5">
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
                      className="bg-transparent border-none p-0 text-xs font-black text-slate-800 focus:ring-0 appearance-none cursor-pointer"
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
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Estruturas MT
                </p>
                {mtStructures.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {mtStructures.map((struct, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                      >
                        {struct}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Sem estruturas MT
                  </p>
                )}
              </section>

              {/* ── Estruturas BT ── */}
              <section>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Estruturas BT
                </p>
                {btStructures.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {btStructures.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Passante — sem estrutura BT
                  </p>
                )}
              </section>

              {/* ── Ramais ── */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users size={10} className="text-emerald-600" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Ramais
                  </p>
                </div>
                {ramais.length > 0 ? (
                  <div className="space-y-1">
                    {ramais.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                      >
                        <span className="w-4 text-center text-slate-300 font-bold">
                          {i + 1}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                          {r.quantity}× {r.ramalType || "MONO"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum cliente
                  </p>
                )}
              </section>

            </div>

            {/* ── Rodapé: resultados de engenharia ── */}
            <div className="grid grid-cols-2 border-t border-slate-100">
              {/* Stress Mecânico */}
              <div className="px-4 py-3 border-r border-slate-100">
                <div className="flex items-center gap-1 mb-1">
                  <Zap
                    size={10}
                    className={
                      mechanicalResult?.overloaded
                        ? "text-rose-500"
                        : "text-slate-400"
                    }
                  />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Stress Mec.
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-base font-black leading-none ${
                      mechanicalResult?.overloaded
                        ? "text-rose-600"
                        : "text-slate-800"
                    }`}
                  >
                    {mechanicalResult?.resultantForceDaN ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    daN
                  </span>
                </div>
              </div>

              {/* Acessibilidade */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1 mb-1">
                  <Truck size={10} className="text-slate-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Acesso
                  </span>
                </div>
                <span
                  className={`text-sm font-bold leading-none ${
                    pole.hasVehicleAccess === false
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
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
