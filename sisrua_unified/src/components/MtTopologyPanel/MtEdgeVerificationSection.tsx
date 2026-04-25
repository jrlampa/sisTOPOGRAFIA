import React from "react";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import type { AppLocale, BtRamalEntry, MtEdge, MtPoleNode } from "../../types";
import { getMtTopologyPanelText } from "../../i18n/mtTopologyPanelText";

const MT_CONDUCTOR_OPTIONS = [
  "70 Al - MX",
  "185 Al - MX",
  "240 Al - MX",
  "95 Al",
  "240 Al",
  "35 Cu",
  "70 Cu",
  "120 Cu",
  "240 Cu",
  "500 Cu",
];

interface MtEdgeVerificationSectionProps {
  locale: AppLocale;
  edges: MtEdge[];
  polesById: Map<string, MtPoleNode>;
  onRemoveEdge: (id: string) => void;
  onSetEdgeChangeFlag: (
    id: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onSetEdgeConductors: (id: string, conductors: BtRamalEntry[]) => void;
}

const MtEdgeVerificationSection: React.FC<MtEdgeVerificationSectionProps> = ({
  locale,
  edges,
  polesById,
  onRemoveEdge,
  onSetEdgeChangeFlag,
  onSetEdgeConductors,
}) => {
  const t = getMtTopologyPanelText(locale);
  const [edgeConductorSelection, setEdgeConductorSelection] = React.useState<
    Record<string, string>
  >({});

  if (edges.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[10px] text-slate-500">
        {t.addSpanMode}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <LinkIcon size={12} className="text-orange-600" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-900">
          {t.edgesSectionTitle} ({edges.length})
        </span>
      </div>
      <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-hide">
        {edges.map((edge) => {
          const from = polesById.get(edge.fromPoleId);
          const to = polesById.get(edge.toPoleId);
          const label = from && to ? `${from.title} → ${to.title}` : edge.id;
          const flag = edge.edgeChangeFlag ?? "existing";
          const selectedConductor =
            edgeConductorSelection[edge.id] ??
            edge.conductors?.[edge.conductors.length - 1]?.conductorName ??
            MT_CONDUCTOR_OPTIONS[0];

          return (
            <div
              key={edge.id}
              className="group flex flex-col gap-1 rounded border border-slate-200 bg-white p-2 transition-all hover:border-orange-300"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold text-slate-700 truncate min-w-0"
                  title={label}
                >
                  {label}
                </span>
                <button
                  onClick={() => onRemoveEdge(edge.id)}
                  title={`${t.removeEdge} ${edge.id}`}
                  aria-label={`${t.removeEdge} ${edge.id}`}
                  className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400">
                  {edge.lengthMeters}m
                </span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => onSetEdgeChangeFlag(edge.id, "existing")}
                    className={`h-5 border px-1.5 rounded text-[9px] font-black uppercase transition-all ${
                      flag === "existing"
                        ? "bg-slate-100 border-slate-400 text-slate-700"
                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {t.ext}
                  </button>
                  <button
                    onClick={() => onSetEdgeChangeFlag(edge.id, "new")}
                    className={`h-5 border px-1.5 rounded text-[9px] font-black uppercase transition-all ${
                      flag === "new"
                        ? "bg-orange-50 border-orange-400 text-orange-700"
                        : "bg-white border-slate-200 text-slate-400 hover:border-orange-200"
                    }`}
                  >
                    {t.newShort}
                  </button>
                </div>
              </div>
              <div className="rounded border border-orange-100 bg-orange-50/40 p-1.5">
                <div className="text-[9px] font-bold uppercase text-orange-800">
                  {t.conductorsLabel}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <select
                    value={selectedConductor}
                    onChange={(e) => {
                      const conductorName = e.target.value;
                      setEdgeConductorSelection((current) => ({
                        ...current,
                        [edge.id]: conductorName,
                      }));
                    }}
                    className="h-6 min-w-0 flex-1 rounded border border-orange-200 bg-white px-1 text-[10px] text-slate-700"
                    aria-label={`${t.conductorsLabel} ${edge.id}`}
                  >
                    {MT_CONDUCTOR_OPTIONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      onSetEdgeConductors(edge.id, [
                        {
                          id: `mt-cond-${Date.now()}`,
                          quantity: 1,
                          conductorName: selectedConductor,
                        },
                      ])
                    }
                    className="h-6 rounded border border-orange-300 px-1.5 text-[9px] font-black uppercase text-orange-800 transition-colors hover:bg-orange-100"
                  >
                    {t.apply}
                  </button>
                </div>
                <div className="mt-1 text-[9px] text-orange-900">
                  {edge.conductors?.length
                    ? edge.conductors
                        .map(
                          (entry) =>
                            `${entry.quantity}x ${entry.conductorName}`,
                        )
                        .join(" | ")
                    : t.noConductor}
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
