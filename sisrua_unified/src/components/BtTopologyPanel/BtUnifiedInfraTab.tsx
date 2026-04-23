import React from "react";
import { CheckCircle2, Circle, MapPin, Hash, Activity, FileText } from "lucide-react";
import type { BtPoleNode, AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import { getFlagColor } from "../MapSelectorStyles";

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
}

const BtUnifiedInfraTab: React.FC<BtUnifiedInfraTabProps> = (props) => {
  const { selectedPole: pole } = props;
  const t = getBtTopologyPanelText(props.locale);
  const pt = t.poleVerification;

  if (!pole) return null;

  const currentFlag = pole.nodeChangeFlag ?? "existing";

  return (
    <div className="space-y-4 pb-6">
      {/* Quick Header / Status */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <MapPin size={16} />
            </div>
            <div>
              <input
                type="text"
                value={pole.title}
                onChange={(e) => props.onBtRenamePole?.(pole.id, e.target.value)}
                className="bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 w-full"
                placeholder={pt.placeholderPoleName}
              />
              <div className="text-[10px] text-slate-400 font-mono">{pole.id}</div>
            </div>
          </div>
          <button
            onClick={() => props.updatePoleVerified(pole.id, !pole.verified)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              pole.verified 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                : "bg-slate-50 text-slate-500 border border-slate-200"
            }`}
          >
            {pole.verified ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            {pole.verified ? "Verificado" : "Pendente"}
          </button>
        </div>

        {/* Change Flags */}
        <div className="flex flex-wrap gap-1.5">
          {(["existing", "new", "replace", "remove"] as const).map((flag) => (
            <button
              key={flag}
              onClick={() => props.onBtSetPoleChangeFlag?.(pole.id, flag)}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                currentFlag === flag
                  ? "bg-white shadow-sm border-blue-200 text-blue-700"
                  : "bg-slate-50 border-transparent text-slate-400 opacity-60 hover:opacity-100"
              }`}
              style={currentFlag === flag ? { borderLeft: `3px solid ${getFlagColor(flag, "#3b82f6")}` } : {}}
            >
              {flag === "existing" ? "Existente" : flag === "new" ? "Novo" : flag === "replace" ? "Troca" : "Remover"}
            </button>
          ))}
        </div>
      </div>

      {/* Spec Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-sm">
          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            <Hash size={10} /> {pt.heightM}
          </label>
          <input
            type="number"
            value={pole.poleSpec?.heightM ?? ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              props.updatePoleSpec(pole.id, { ...pole.poleSpec, heightM: isNaN(val) ? undefined : val });
            }}
            className="w-full bg-slate-50 border-none rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100"
            placeholder="Ex: 11"
          />
        </div>
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-sm">
          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            <Activity size={10} /> {pt.effortDan}
          </label>
          <input
            type="number"
            value={pole.poleSpec?.nominalEffortDan ?? ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              props.updatePoleSpec(pole.id, { ...pole.poleSpec, nominalEffortDan: isNaN(val) ? undefined : val });
            }}
            className="w-full bg-slate-50 border-none rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100"
            placeholder="Ex: 400"
          />
        </div>
      </div>

      {/* Physical State & Structures */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-sm space-y-4">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">{pt.poleStateTitle}</label>
          <select
            value={pole.conditionStatus ?? ""}
            onChange={(e) => props.updatePoleConditionStatus(pole.id, e.target.value || undefined)}
            className="w-full bg-slate-50 border-none rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{pt.selectState}</option>
            <option value="bom_estado">{pt.stateGood}</option>
            <option value="desaprumado">{pt.stateLeaning}</option>
            <option value="trincado">{pt.stateCracked}</option>
            <option value="condenado">{pt.stateCondemned}</option>
          </select>
        </div>

        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">{pt.structuresTitle}</label>
          <div className="grid grid-cols-2 gap-2">
            {(["si1", "si2", "si3", "si4"] as const).map((slot) => (
              <input
                key={slot}
                type="text"
                placeholder={slot.toUpperCase()}
                value={pole.btStructures?.[slot] ?? ""}
                onChange={(e) => props.updatePoleBtStructures(pole.id, { ...pole.btStructures, [slot]: e.target.value || undefined })}
                className="bg-slate-50 border-none rounded-lg p-2 text-[10px] font-mono font-bold text-slate-700 placeholder:opacity-30 focus:ring-2 focus:ring-blue-100"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-sm">
        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
          <FileText size={10} /> {pt.generalNotesTitle}
        </label>
        <textarea
          value={pole.generalNotes ?? ""}
          onChange={(e) => props.updatePoleGeneralNotes(pole.id, e.target.value || undefined)}
          rows={3}
          className="w-full bg-slate-50 border-none rounded-lg p-2 text-[11px] text-slate-800 focus:ring-2 focus:ring-blue-100 resize-none"
          placeholder={pt.generalNotesPlaceholder}
        />
      </div>
    </div>
  );
};

export default BtUnifiedInfraTab;
