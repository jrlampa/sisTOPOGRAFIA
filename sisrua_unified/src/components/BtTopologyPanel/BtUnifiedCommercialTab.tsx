import React from "react";
import { ShoppingCart, Plus, Trash2, TrendingUp, Users, Tag, Activity } from "lucide-react";
import type { BtPoleNode, BtPoleRamalEntry, AppLocale, BtProjectType } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import { 
  CLANDESTINO_RAMAL_TYPE, 
  NORMAL_CLIENT_RAMAL_TYPES, 
  nextId, 
  numberFromInput 
} from "./BtTopologyPanelUtils";
import type { BtPoleAccumulatedDemand } from "../../services/btDerivedService";

interface BtUnifiedCommercialTabProps {
  locale: AppLocale;
  projectType: BtProjectType;
  selectedPole: BtPoleNode | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  updatePoleRamais: (poleId: string, r: BtPoleRamalEntry[]) => void;
}

const RAMAL_QUICK_NOTES: Array<{
  value: string;
  labelKey: "deteriorated" | "splices" | "noInsulation" | "long" | "crossing" | "other";
}> = [
  { value: "deteriorado", labelKey: "deteriorated" },
  { value: "emendas", labelKey: "splices" },
  { value: "sem_isolamento", labelKey: "noInsulation" },
  { value: "ramal_longo", labelKey: "long" },
  { value: "cruzamento", labelKey: "crossing" },
  { value: "outro", labelKey: "other" },
];

const BtUnifiedCommercialTab: React.FC<BtUnifiedCommercialTabProps> = (props) => {
  const { selectedPole: pole, accumulatedByPole } = props;
  const t = getBtTopologyPanelText(props.locale);
  const pt = t.poleVerification;

  if (!pole) return null;

  const poleDemand = accumulatedByPole.find(d => d.poleId === pole.id);
  const ramais = pole.ramais ?? [];

  const handleAddRamal = () => {
    const defaultRamalType = props.projectType === "clandestino" 
      ? CLANDESTINO_RAMAL_TYPE 
      : NORMAL_CLIENT_RAMAL_TYPES[0];
    
    props.updatePoleRamais(pole.id, [
      ...ramais,
      { id: nextId("RP"), quantity: 1, ramalType: defaultRamalType }
    ]);
  };

  const handleUpdateRamal = (id: string, updates: Partial<BtPoleRamalEntry>) => {
    props.updatePoleRamais(pole.id, ramais.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleRemoveRamal = (id: string) => {
    props.updatePoleRamais(pole.id, ramais.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4 pb-6">
      {/* SECTION: Stats / Demand */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <TrendingUp size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
            Estatísticas de Carga
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
            <Users size={14} className="mx-auto mb-1 text-emerald-600 opacity-50" />
            <div className="text-[14px] font-black text-emerald-800 leading-none">
              {poleDemand?.accumulatedClients ?? 0}
            </div>
            <div className="text-[8px] font-black uppercase tracking-tighter text-emerald-600 mt-1">Clientes</div>
          </div>
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
            <Activity size={14} className="mx-auto mb-1 text-blue-600 opacity-50" />
            <div className="text-[14px] font-black text-blue-800 leading-none">
              {poleDemand?.accumulatedDemandKva?.toFixed(2) ?? "0.00"}
            </div>
            <div className="text-[8px] font-black uppercase tracking-tighter text-blue-600 mt-1">kVA (Demanda)</div>
          </div>
        </div>
      </div>

      {/* SECTION: Ramais */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <ShoppingCart size={16} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
              {pt.ramaisTitle}
            </h3>
          </div>
          <button
            onClick={handleAddRamal}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} />
          </button>
        </div>

        {ramais.length === 0 ? (
          <div className="text-[10px] text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            {pt.noRamais}
          </div>
        ) : (
          <div className="space-y-4">
            {ramais.map((ramal) => (
              <div key={ramal.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={ramal.quantity}
                      onChange={(e) => handleUpdateRamal(ramal.id, { quantity: Math.max(1, numberFromInput(e.target.value)) })}
                      className="w-12 bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                    />
                    <select
                      value={ramal.ramalType ?? (props.projectType === "clandestino" ? CLANDESTINO_RAMAL_TYPE : NORMAL_CLIENT_RAMAL_TYPES[0])}
                      onChange={(e) => handleUpdateRamal(ramal.id, { ramalType: e.target.value })}
                      className="flex-1 bg-white border border-slate-200 rounded p-1 text-[10px] font-bold"
                    >
                      {(props.projectType === "clandestino" ? [CLANDESTINO_RAMAL_TYPE] : NORMAL_CLIENT_RAMAL_TYPES).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => handleRemoveRamal(ramal.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {RAMAL_QUICK_NOTES.map((chip) => {
                      const label = pt.quickNotes[chip.labelKey];
                      const isActive = ramal.notes === label;
                      return (
                        <button
                          key={chip.value}
                          onClick={() => handleUpdateRamal(ramal.id, { notes: isActive ? undefined : label })}
                          className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border transition-all ${
                            isActive 
                              ? "bg-amber-100 border-amber-200 text-amber-700" 
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <Tag size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      value={ramal.notes ?? ""}
                      onChange={(e) => handleUpdateRamal(ramal.id, { notes: e.target.value || undefined })}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-6 pr-2 text-[10px] placeholder:opacity-30"
                      placeholder={pt.freeObservation}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BtUnifiedCommercialTab;
