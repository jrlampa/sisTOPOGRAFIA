import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { BtTopology, BtEdge, BtNetworkScenario } from "../../types";
import {
  CONDUCTOR_NAMES,
  MT_CONDUCTOR_NAMES,
  getEdgeChangeFlag,
  nextId,
  } from "./BtTopologyPanelUtils";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

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
  btNetworkScenario,
  selectedEdge,
  selectedEdgeId,
  selectEdge,
  updateEdgeVerified: _updateEdgeVerified,
  updateEdgeConductors,
  updateEdgeReplacementFromConductors: _updateEdgeReplacementFromConductors,
  updateEdgeMtConductors,
  onBtSetEdgeChangeFlag,
}) => {
  const t = getBtTopologyPanelText(locale).transformerEdge;
  
  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {btNetworkScenario === "asis" ? t.edgeTitleAsis : t.edgeTitleProject}
      </div>

      {btTopology.edges.length === 0 ? (
        <div className="text-[10px] text-slate-500 italic">
          {t.noEdge}
        </div>
      ) : (
        <React.Fragment>
          <select
            className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-800"
            value={selectedEdgeId}
            onChange={(e) => selectEdge(e.target.value)}
            title={t.edgeTitle}
          >
            {btTopology.edges.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} ({e.fromPoleId} ↔ {e.toPoleId})
              </option>
            ))}
          </select>

          {selectedEdge && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {(["existing", "new", "replace", "remove"] as const).map(
                  (flag) => (
                    <button
                      key={flag}
                      onClick={() =>
                        onBtSetEdgeChangeFlag?.(selectedEdge.id, flag)
                      }
                      className={`rounded px-2 py-1 text-[9px] border ${getEdgeChangeFlag(selectedEdge) === flag ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white"}`}
                    >
                      {flag.toUpperCase()}
                    </button>
                  ),
                )}
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.edgeComposition} (BT)
                </div>
                {selectedEdge.conductors.map((c) => (
                  <div key={c.id} className="flex gap-2 items-center">
                    <span className="text-[10px] w-6">{c.quantity}x</span>
                    <span className="text-[10px] flex-1 truncate">
                      {c.conductorName}
                    </span>
                    <button
                      onClick={() =>
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.filter(
                            (item) => item.id !== c.id,
                          ),
                        )
                      }
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

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
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-slate-300 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
                >
                  <Plus size={10} /> {t.btnAddConductor}
                </button>
              </div>

              {/* MT Conductors Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-[10px] font-bold text-sky-600 uppercase">
                  Composição (MT)
                </div>
                {(selectedEdge.mtConductors || []).map((c) => (
                  <div key={c.id} className="flex gap-2 items-center">
                    <span className="text-[10px] w-6">{c.quantity}x</span>
                    <span className="text-[10px] flex-1 truncate text-sky-800">
                      {c.conductorName}
                    </span>
                    <button
                      onClick={() => {
                        const nextMt = (selectedEdge.mtConductors || []).filter(item => item.id !== c.id);
                        updateEdgeMtConductors?.(selectedEdge.id, nextMt);
                      }}
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const nextMt = [
                      ...(selectedEdge.mtConductors || []),
                      {
                        id: nextId("MT"),
                        quantity: 1,
                        conductorName: MT_CONDUCTOR_NAMES[0],
                      },
                    ];
                    updateEdgeMtConductors?.(selectedEdge.id, nextMt);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-sky-300 py-1 text-[10px] text-sky-600 hover:bg-sky-50"
                >
                  <Plus size={10} /> Adicionar MT
                </button>
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
};

export default BtTopologyEdgeSubSection;
