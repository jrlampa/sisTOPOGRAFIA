import React from "react";
import { Trash2, Link as LinkIcon } from "lucide-react";
import type { MtEdge, MtPoleNode } from "../../types";

interface MtEdgeVerificationSectionProps {
  edges: MtEdge[];
  polesById: Map<string, MtPoleNode>;
  onRemoveEdge: (id: string) => void;
  onSetEdgeChangeFlag: (id: string, flag: "existing" | "new" | "remove" | "replace") => void;
}

const MtEdgeVerificationSection: React.FC<MtEdgeVerificationSectionProps> = ({
  edges,
  polesById,
  onRemoveEdge,
  onSetEdgeChangeFlag,
}) => {
  if (edges.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[10px] text-slate-500">
        Nenhum vão MT cadastrado. Use o modo &quot;Vão&quot; no mapa.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <LinkIcon size={12} className="text-orange-600" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-900">Vãos MT ({edges.length})</span>
      </div>
      <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-hide">
        {edges.map((edge) => {
          const from = polesById.get(edge.fromPoleId);
          const to = polesById.get(edge.toPoleId);
          const label = from && to ? `${from.title} → ${to.title}` : edge.id;
          const flag = edge.edgeChangeFlag ?? "existing";

          return (
            <div
              key={edge.id}
              className="group flex flex-col gap-1 rounded border border-slate-200 bg-white p-2 transition-all hover:border-orange-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 truncate min-w-0" title={label}>
                  {label}
                </span>
                <button
                  onClick={() => onRemoveEdge(edge.id)}
                  className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400">{edge.lengthMeters}m</span>
                <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => onSetEdgeChangeFlag(edge.id, "existing")}
                      className={`h-5 border px-1.5 rounded text-[9px] font-black uppercase transition-all ${
                        flag === "existing" 
                        ? "bg-slate-100 border-slate-400 text-slate-700"
                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      Ext
                    </button>
                    <button
                      onClick={() => onSetEdgeChangeFlag(edge.id, "new")}
                      className={`h-5 border px-1.5 rounded text-[9px] font-black uppercase transition-all ${
                        flag === "new" 
                        ? "bg-orange-50 border-orange-400 text-orange-700"
                        : "bg-white border-slate-200 text-slate-400 hover:border-orange-200"
                      }`}
                    >
                      Novo
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MtEdgeVerificationSection;
