import React from "react";
import {
  Plus,
  Trash2,
  Zap,
  Activity,
  Weight,
  ArrowRightLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BtTopology, BtEdge, BtNetworkScenario } from "../../types";
import {
  CONDUCTOR_NAMES,
  MT_CONDUCTOR_NAMES,
  getEdgeChangeFlag,
  nextId,
} from "./BtTopologyPanelUtils";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

// Simulação de dados mecânicos para feedback na UI (Deve ser sincronizado com o backend futuramente)
const MEC_DATA: Record<string, { traction: number; weight: number }> = {
  "70 Al - MX": { traction: 200, weight: 0.85 },
  "35 Al - MX": { traction: 110, weight: 0.45 },
  "120 Al - MX": { traction: 350, weight: 1.45 },
  "185 Al - MX": { traction: 520, weight: 2.2 },
  "MT-4-AWG-AL": { traction: 150, weight: 0.15 },
  "MT-70-PROT": { traction: 250, weight: 0.9 },
};

interface BtTopologyEdgeSubSectionProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  selectedEdge: BtEdge | null;
  selectedEdgeId: string;
  selectEdge: (id: string) => void;
  updateEdgeVerified: (id: string, v: boolean) => void;
  updateEdgeConductors: (
    id: string,
    c: BtTopology["edges"][number]["conductors"],
  ) => void;
  updateEdgeReplacementFromConductors: (
    id: string,
    rc: BtTopology["edges"][number]["conductors"],
  ) => void;
  updateEdgeMtConductors?: (
    id: string,
    mtc: BtTopology["edges"][number]["conductors"],
  ) => void;
  onBtSetEdgeChangeFlag?: (
    id: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
}

const BtTopologyEdgeSubSection: React.FC<BtTopologyEdgeSubSectionProps> = ({
  locale,
  btTopology,
  btNetworkScenario: _btNetworkScenario,
  selectedEdge,
  selectedEdgeId,
  selectEdge,
  updateEdgeVerified: _updateEdgeVerified,
  updateEdgeConductors,
  updateEdgeReplacementFromConductors: _updateEdgeReplacementFromConductors,
  updateEdgeMtConductors,
  onBtSetEdgeChangeFlag,
}) => {
  const _t = getBtTopologyPanelText(locale).transformerEdge;

  if (!selectedEdge) return null;

  const allCircuits = [
    ...(selectedEdge.conductors || []).map((c) => ({
      ...c,
      type: "BT" as const,
    })),
    ...(selectedEdge.mtConductors || []).map((c) => ({
      ...c,
      type: "MT" as const,
    })),
  ];

  const totalTraction = allCircuits.reduce(
    (acc, c) => acc + (MEC_DATA[c.conductorName]?.traction || 200) * c.quantity,
    0,
  );
  const totalWeight = allCircuits.reduce(
    (acc, c) => acc + (MEC_DATA[c.conductorName]?.weight || 0.85) * c.quantity,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Vão Selector & Flags */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
            <ArrowRightLeft size={14} />
          </div>
          <select
            className="flex-1 bg-transparent border-none p-0 text-xs font-black text-slate-800 focus:ring-0"
            value={selectedEdgeId}
            onChange={(e) => selectEdge(e.target.value)}
          >
            {btTopology.edges.map((e) => (
              <option key={e.id} value={e.id}>
                VÃO: {e.fromPoleId} → {e.toPoleId}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {(["existing", "new", "replace", "remove"] as const).map((flag) => (
            <button
              key={flag}
              onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, flag)}
              className={`flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-tighter border transition-all ${
                getEdgeChangeFlag(selectedEdge) === flag
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
              }`}
            >
              {flag === "existing"
                ? "Mant."
                : flag === "new"
                  ? "Inst."
                  : flag === "replace"
                    ? "Subst."
                    : "Sucata"}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Circuit List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Circuitos no Vão
          </span>
          <div className="flex gap-1">
            <button
              onClick={() =>
                updateEdgeConductors(selectedEdge.id, [
                  ...selectedEdge.conductors,
                  {
                    id: nextId("C"),
                    quantity: 1,
                    conductorName: CONDUCTOR_NAMES[0],
                  },
                ])
              }
              className="p-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
              title="Adicionar Circuito BT"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={() =>
                updateEdgeMtConductors?.(selectedEdge.id, [
                  ...(selectedEdge.mtConductors || []),
                  {
                    id: nextId("MT"),
                    quantity: 1,
                    conductorName: MT_CONDUCTOR_NAMES[0],
                  },
                ])
              }
              className="p-1 bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors"
              title="Adicionar Circuito MT"
            >
              <Zap size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {allCircuits.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`group flex items-center gap-2 p-2 rounded-xl border transition-all ${
                  c.type === "MT"
                    ? "bg-amber-50/30 border-amber-100"
                    : "bg-white border-slate-100"
                }`}
              >
                <div
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${
                    c.type === "MT"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {c.type}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-bold text-slate-700 truncate">
                    {c.quantity}x {c.conductorName}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 opacity-60">
                    <span className="flex items-center gap-0.5 text-[8px] font-bold">
                      <Activity size={8} />{" "}
                      {(MEC_DATA[c.conductorName]?.traction || 0) * c.quantity}{" "}
                      daN
                    </span>
                    <span className="flex items-center gap-0.5 text-[8px] font-bold">
                      <Weight size={8} />{" "}
                      {(MEC_DATA[c.conductorName]?.weight || 0).toFixed(2)}{" "}
                      daN/m
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (c.type === "BT") {
                      updateEdgeConductors(
                        selectedEdge.id,
                        selectedEdge.conductors.filter(
                          (item) => item.id !== c.id,
                        ),
                      );
                    } else {
                      updateEdgeMtConductors?.(
                        selectedEdge.id,
                        (selectedEdge.mtConductors || []).filter(
                          (item) => item.id !== c.id,
                        ),
                      );
                    }
                  }}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Aggregated Span Summary */}
      <div className="bg-slate-900 rounded-2xl p-3 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity size={48} />
        </div>
        <div className="relative z-10">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            Resumo de Esforço do Vão
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold opacity-60 uppercase">
                Tração Total
              </div>
              <div className="text-sm font-black text-blue-400">
                {totalTraction}{" "}
                <small className="text-xs opacity-70">daN</small>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold opacity-60 uppercase">
                Peso Estimado
              </div>
              <div className="text-sm font-black text-emerald-400">
                {totalWeight.toFixed(2)}{" "}
                <small className="text-xs opacity-70">daN/m</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BtTopologyEdgeSubSection;
