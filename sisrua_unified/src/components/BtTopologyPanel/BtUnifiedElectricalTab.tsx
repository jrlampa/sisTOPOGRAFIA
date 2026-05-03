import React from "react";
import {
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import BtTopologyTransformerSubSection from "./BtTopologyTransformerSubSection";
import BtTopologyEdgeSubSection from "./BtTopologyEdgeSubSection";
import { useBtTopologyContext } from "./BtTopologyContext";

const BtUnifiedElectricalTab: React.FC = () => {
  const {
    locale,
    btTopology,
    btNetworkScenario,
    selectedPole: pole,
    selectedTransformerId,
    selectedTransformer,
    selectedEdgeId,
    selectedEdge,
    transformerDebugById,
    onBtRenameTransformer,
    onBtSetTransformerChangeFlag,
    updateTransformerVerified,
    updateTransformerReadings,
    updateTransformerProjectPower,
    onBtSetEdgeChangeFlag,
    updateEdgeVerified,
    updateEdgeConductors,
    updateEdgeMtConductors,
    updateEdgeReplacementFromConductors,
    onSelectedEdgeChange,
    onSelectedTransformerChange,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale);

  if (!pole) return null;

  // Find transformer on this pole
  const poleTransformer = btTopology.transformers.find(
    (t) => t.poleId === pole.id,
  );

  // Find edges connected to this pole
  const connectedEdges = btTopology.edges.filter(
    (edge) => edge.fromPoleId === pole.id || edge.toPoleId === pole.id,
  );

  return (
    <div className="space-y-4 pb-6">
      {/* SECTION: Transformer */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm dark:bg-zinc-900/40 dark:border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            <Zap size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
            {t.dashboard.transformerContext}
          </h3>
        </div>

        {poleTransformer ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-amber-50/50 rounded-xl border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded dark:bg-amber-900/40 dark:text-amber-200">
                  {poleTransformer.title}
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {poleTransformer.projectPowerKva ?? 0} kVA
                </span>
              </div>
              <button
                onClick={() =>
                  onSelectedTransformerChange(poleTransformer.id)
                }
                className="text-xs font-black uppercase tracking-tighter text-amber-600 hover:underline dark:text-amber-400"
              >
                Editar Detalhes
              </button>
            </div>

            {/* If this specific transformer is selected, show the sub-section editor */}
            {selectedTransformerId === poleTransformer.id && (
              <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <BtTopologyTransformerSubSection
                  locale={locale}
                  btTopology={btTopology}
                  btNetworkScenario={btNetworkScenario}
                  selectedTransformer={selectedTransformer}
                  isTransformerDropdownOpen={false}
                  setIsTransformerDropdownOpen={() => {}}
                  selectTransformer={onSelectedTransformerChange}
                  transformerDebugById={transformerDebugById}
                  pointDemandKva={0} // Not needed for this view
                  onBtRenameTransformer={onBtRenameTransformer}
                  onBtSetTransformerChangeFlag={
                    onBtSetTransformerChangeFlag
                  }
                  updateTransformerVerified={updateTransformerVerified}
                  updateTransformerReadings={updateTransformerReadings}
                  updateTransformerProjectPower={
                    updateTransformerProjectPower
                  }
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-xl border border-slate-100 text-center dark:bg-zinc-950 dark:text-slate-500 dark:border-white/5">
            Sem transformador neste poste
          </div>
        )}
      </div>

      {/* SECTION: Connected Edges */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm dark:bg-zinc-900/40 dark:border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
            <Layers size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
            {t.dashboard.edgeContext}s Conectados ({connectedEdges.length})
          </h3>
        </div>

        <div className="space-y-2">
          {connectedEdges.map((edge) => {
            const isSelected = selectedEdgeId === edge.id;
            const isOutgoing = edge.fromPoleId === pole.id;
            const otherPoleId = isOutgoing ? edge.toPoleId : edge.fromPoleId;
            const otherPole = btTopology.poles.find(
              (p) => p.id === otherPoleId,
            );

            return (
              <div key={edge.id} className="space-y-2">
                <button
                  onClick={() => onSelectedEdgeChange(edge.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-blue-50 border-blue-200 shadow-sm dark:bg-blue-950/20 dark:border-blue-900/40"
                      : "bg-white border-slate-100 hover:border-blue-100 dark:bg-zinc-950 dark:border-white/5 dark:hover:border-blue-900/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${isOutgoing ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"}`}
                    >
                      {isOutgoing ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownLeft size={12} />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isOutgoing ? "Para: " : "De: "}
                        <span className="font-mono text-blue-600 dark:text-blue-400">
                          {otherPole?.title ?? otherPoleId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium dark:text-slate-500">
                        {edge.conductors.length} condutores •{" "}
                        {edge.lengthMeters?.toFixed(1) ?? "0.0"}m
                      </div>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${
                      edge.verified
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-400 dark:bg-zinc-900 dark:text-slate-600"
                    }`}
                  >
                    {edge.verified ? (
                      <CheckCircle2 size={10} />
                    ) : (
                      <Circle size={10} />
                    )}
                    {edge.verified ? "OK" : "PEND"}
                  </div>
                </button>

                {/* If this edge is selected, show the sub-section editor */}
                {isSelected && (
                  <div className="p-3 bg-blue-50/30 rounded-2xl border border-blue-100/50 animate-in fade-in zoom-in-95 duration-300 dark:bg-blue-950/5 dark:border-blue-900/20">
                    <BtTopologyEdgeSubSection
                      locale={locale}
                      btTopology={btTopology}
                      btNetworkScenario={btNetworkScenario}
                      selectedEdge={selectedEdge}
                      selectedEdgeId={selectedEdgeId}
                      selectEdge={onSelectedEdgeChange}
                      updateEdgeVerified={updateEdgeVerified}
                      updateEdgeConductors={updateEdgeConductors}
                      updateEdgeMtConductors={updateEdgeMtConductors}
                      updateEdgeReplacementFromConductors={
                        updateEdgeReplacementFromConductors
                      }
                      onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {connectedEdges.length === 0 && (
            <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-xl border border-slate-100 text-center dark:bg-zinc-950 dark:text-slate-500 dark:border-white/5">
              Nenhum vão conectado
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BtUnifiedElectricalTab;
