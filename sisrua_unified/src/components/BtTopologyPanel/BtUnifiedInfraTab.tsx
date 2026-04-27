import React from "react";
import { CheckCircle2, Circle, MapPin, Hash, Activity, FileText, Zap } from "lucide-react";
import type { BtPoleNode, AppLocale, MtTopology } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import PoleCockpitCard from "./Cockpit/PoleCockpitCard";
import type { BtDerivedSummary, BtPoleAccumulatedDemand } from "../../services/btDerivedService";

interface BtUnifiedInfraTabProps {
  locale: AppLocale;
  selectedPole: BtPoleNode | null;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (poleId: string, flag: any) => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, active: boolean) => void;
  updatePoleVerified: (poleId: string, v: boolean) => void;
  updatePoleSpec: (poleId: string, s: any) => void;
  updatePoleBtStructures: (poleId: string, s: any) => void;
  updatePoleConditionStatus: (poleId: string, s: any) => void;
  updatePoleEquipmentNotes: (poleId: string, s: any) => void;
  updatePoleGeneralNotes: (poleId: string, s: any) => void;
  mtTopology: MtTopology;
  summary: BtDerivedSummary;
  accumulatedByPole: BtPoleAccumulatedDemand[];
}

const BtUnifiedInfraTab: React.FC<BtUnifiedInfraTabProps> = (props) => {
  const { selectedPole: pole } = props;
  const t = getBtTopologyPanelText(props.locale);
  const pt = t.poleVerification;
  const dashboardText = t.dashboard;

  if (!pole) return null;

  // Encontrar resultados do cockpit nos dados derivados (Simulação até integração total da API)
  const accData = props.accumulatedByPole.find(a => a.poleId === pole.id);

  // Mocks de resultados dos motores recém-criados para visualização imediata no Cockpit
  const mechanicalResult = accData ? {
    resultantForceDaN: Math.round(Math.random() * 450), // Simulando motor 2.5D
    overloaded: Math.random() > 0.8,
    resultantAngleDegrees: 45
  } : undefined;

  const accessibilityCost = pole.hasVehicleAccess === false 
    ? (pole.manualDragDistanceMeters || 0) * 0.005 * 500 // Simulando AccessibilityProcessor
    : 0;

  // Extrair estruturas de MT para o cockpit
  const mtPole = props.mtTopology.poles.find(p => p.id === pole.id);
  const mtStructures = mtPole ? Object.values(mtPole.mtStructures || {}).filter(Boolean) : [];

  return (
    <div className="space-y-4 pb-6">
      <PoleCockpitCard 
        pole={pole}
        mtStructures={mtStructures}
        locale={props.locale}
        onRename={(id, title) => props.onBtRenamePole?.(id, title)}
        onSetFlag={(id, flag) => props.onBtSetPoleChangeFlag?.(id, flag)}
        onUpdateSpec={(id, spec) => props.updatePoleSpec(id, spec)}
        onUpdateAcessibilidade={(id, hasAccess, dist) => {
            props.updatePoleSpec(id, { 
                ...pole, 
                hasVehicleAccess: hasAccess, 
                manualDragDistanceMeters: dist 
            });
        }}
        mechanicalResult={mechanicalResult}
        accessibilityCost={accessibilityCost}
      />

      {/* Physical State & Structures */}
      <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{pt.poleStateTitle}</label>
          <select
            value={pole.conditionStatus ?? ""}
            onChange={(e) => props.updatePoleConditionStatus(pole.id, e.target.value || undefined)}
            className="w-full bg-slate-50 border-none rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{pt.selectState}</option>
            <option value="bom_estado">{pt.stateGood}</option>
            <option value="desaprumado">{pt.stateLeaning}</option>
            <option value="trincado">{pt.stateCracked}</option>
            <option value="condenado">{pt.stateCondemned}</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{pt.structuresTitle}</label>
          <div className="grid grid-cols-2 gap-2">
            {(["si1", "si2", "si3", "si4"] as const).map((slot) => (
              <input
                key={slot}
                type="text"
                placeholder={slot.toUpperCase()}
                value={pole.btStructures?.[slot] ?? ""}
                onChange={(e) => props.updatePoleBtStructures(pole.id, { ...pole.btStructures, [slot]: e.target.value || undefined })}
                className="bg-slate-50 border-none rounded-xl p-2.5 text-[10px] font-mono font-bold text-slate-700 placeholder:opacity-30 focus:ring-2 focus:ring-blue-100"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-slate-200 shadow-sm">
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          <FileText size={12} /> {pt.generalNotesTitle}
        </label>
        <textarea
          value={pole.generalNotes ?? ""}
          onChange={(e) => props.updatePoleGeneralNotes(pole.id, e.target.value || undefined)}
          rows={3}
          className="w-full bg-slate-50 border-none rounded-xl p-3 text-[11px] text-slate-800 focus:ring-2 focus:ring-blue-100 resize-none"
          placeholder={pt.generalNotesPlaceholder}
        />
      </div>

      {/* MT Context (Unified Vision) */}
      {props.mtTopology.poles.some(p => p.id === pole.id) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-100/50 border border-orange-200 rounded-3xl p-4 shadow-sm">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-700/60 mb-3">
            <Zap size={12} /> {dashboardText.mediumVoltageContext}
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-white/60 p-2.5 rounded-xl border border-orange-200/30">
              <span className="text-[10px] font-bold text-orange-900/70 uppercase">
                {dashboardText.mediumVoltageStructures}
              </span>
              <span className="text-xs font-mono font-bold text-orange-800">
                {(() => {
                  const mtPole = props.mtTopology.poles.find(
                    (p) => p.id === pole.id,
                  );
                  if (!mtPole?.mtStructures) return dashboardText.notAvailable;
                  return Object.values(mtPole.mtStructures)
                    .filter(Boolean)
                    .join(" / ");
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center bg-white/60 p-2.5 rounded-xl border border-orange-200/30">
              <span className="text-[10px] font-bold text-orange-900/70 uppercase">{dashboardText.mediumVoltageConnections}</span>
              <span className="text-xs font-mono font-bold text-orange-800">
                {dashboardText.spansCount(
                  props.mtTopology.edges.filter(e => e.fromPoleId === pole.id || e.toPoleId === pole.id).length,
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BtUnifiedInfraTab;
