import React from "react";
import { Zap, Activity, Layers, ArrowUpRight, ArrowDownLeft, CheckCircle2, Circle } from "lucide-react";
import type { BtTopology, BtPoleNode, BtTransformer, BtEdge, AppLocale, BtNetworkScenario } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import BtTopologyTransformerSubSection from "./BtTopologyTransformerSubSection";
import BtTopologyEdgeSubSection from "./BtTopologyEdgeSubSection";

interface BtUnifiedElectricalTabProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  selectedPole: BtPoleNode | null;
  selectedTransformerId: string;
  selectedTransformer: BtTransformer | null;
  selectedEdgeId: string;
  selectedEdge: BtEdge | null;
  transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>;
  onBtRenameTransformer?: (id: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (id: string, flag: any) => void;
  updateTransformerVerified: (id: string, v: boolean) => void;
  updateTransformerReadings: (id: string, r: any[]) => void;
  updateTransformerProjectPower: (id: string, p: number) => void;
  onBtSetEdgeChangeFlag?: (id: string, flag: any) => void;
  updateEdgeVerified: (id: string, v: boolean) => void;
  updateEdgeConductors: (id: string, c: any) => void;
  updateEdgeReplacementFromConductors: (id: string, rc: any) => void;
  onSelectedEdgeChange: (id: string) => void;
  onSelectedTransformerChange: (id: string) => void;
}

const BtUnifiedElectricalTab: React.FC<BtUnifiedElectricalTabProps> = (props) => {
  const { selectedPole: pole, btTopology } = props;
  const t = getBtTopologyPanelText(props.locale);
  
  if (!pole) return null;

  // Find transformer on this pole
  const poleTransformer = btTopology.transformers.find(t => t.poleId === pole.id);
  
  // Find edges connected to this pole
  const connectedEdges = btTopology.edges.filter(
    edge => edge.fromPoleId === pole.id || edge.toPoleId === pole.id
  );

  return (
    <div className="space-y-4 pb-6">
      {/* SECTION: Transformer */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Zap size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
            {t.dashboard.transformerContext}
          </h3>
        </div>

        {poleTransformer ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-amber-50/50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  {poleTransformer.title}
                </span>
                <span className="text-[10px] font-bold text-amber-700">
                  {poleTransformer.projectPowerKva ?? 0} kVA
                </span>
              </div>
              <button 
                onClick={() => props.onSelectedTransformerChange(poleTransformer.id)}
                className="text-[9px] font-black uppercase tracking-tighter text-amber-600 hover:underline"
              >
                Editar Detalhes
              </button>
            </div>
            
            {/* If this specific transformer is selected, show the sub-section editor */}
            {props.selectedTransformerId === poleTransformer.id && (
              <div className="mt-2 pt-2 border-t border-amber-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <BtTopologyTransformerSubSection
                  locale={props.locale}
                  btTopology={props.btTopology}
                  btNetworkScenario={props.btNetworkScenario}
                  selectedTransformer={props.selectedTransformer}
                  isTransformerDropdownOpen={false}
                  setIsTransformerDropdownOpen={() => {}}
                  selectTransformer={props.onSelectedTransformerChange}
                  transformerDebugById={props.transformerDebugById}
                  pointDemandKva={0} // Not needed for this view
                  onBtRenameTransformer={props.onBtRenameTransformer}
                  onBtSetTransformerChangeFlag={props.onBtSetTransformerChangeFlag}
                  updateTransformerVerified={props.updateTransformerVerified}
                  updateTransformerReadings={props.updateTransformerReadings}
                  updateTransformerProjectPower={props.updateTransformerProjectPower}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
            Sem transformador neste poste
          </div>
        )}
      </div>

      {/* SECTION: Connected Edges */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Layers size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
            {t.dashboard.edgeContext}s Conectados ({connectedEdges.length})
          </h3>
        </div>

        <div className="space-y-2">
          {connectedEdges.map(edge => {
            const isSelected = props.selectedEdgeId === edge.id;
            const isOutgoing = edge.fromPoleId === pole.id;
            const otherPoleId = isOutgoing ? edge.toPoleId : edge.fromPoleId;
            const otherPole = btTopology.poles.find(p => p.id === otherPoleId);
            
            return (
              <div key={edge.id} className="space-y-2">
                <button
                  onClick={() => props.onSelectedEdgeChange(edge.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isSelected 
                      ? "bg-blue-50 border-blue-200 shadow-sm" 
                      : "bg-white border-slate-100 hover:border-blue-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isOutgoing ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                      {isOutgoing ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-slate-700">
                        {isOutgoing ? "Para: " : "De: "} 
                        <span className="font-mono text-blue-600">{otherPole?.title ?? otherPoleId}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        {edge.conductors.length} condutores • {edge.lengthMeters?.toFixed(1) ?? "0.0"}m
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${
                    edge.verified ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    {edge.verified ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                    {edge.verified ? "OK" : "PEND"}
                  </div>
                </button>

                {/* If this edge is selected, show the sub-section editor */}
                {isSelected && (
                  <div className="p-3 bg-blue-50/30 rounded-2xl border border-blue-100/50 animate-in fade-in zoom-in-95 duration-300">
                    <BtTopologyEdgeSubSection
                      locale={props.locale}
                      btTopology={props.btTopology}
                      btNetworkScenario={props.btNetworkScenario}
                      selectedEdge={props.selectedEdge}
                      selectedEdgeId={props.selectedEdgeId}
                      selectEdge={props.onSelectedEdgeChange}
                      updateEdgeVerified={props.updateEdgeVerified}
                      updateEdgeConductors={props.updateEdgeConductors}
                      updateEdgeReplacementFromConductors={props.updateEdgeReplacementFromConductors}
                      onBtSetEdgeChangeFlag={props.onBtSetEdgeChangeFlag}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          {connectedEdges.length === 0 && (
            <div className="text-[10px] text-slate-400 italic p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
              Nenhum vão conectado
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BtUnifiedElectricalTab;
