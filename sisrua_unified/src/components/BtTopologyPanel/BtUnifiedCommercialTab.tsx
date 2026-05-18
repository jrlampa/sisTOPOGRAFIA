import React from 'react';
import { ShoppingCart, Plus, Trash2, TrendingUp, Users, Tag, Activity } from 'lucide-react';
import type { BtPoleRamalEntry } from '../../types';
import { getBtTopologyPanelText } from '../../i18n/btTopologyPanelText';
import {
  CLANDESTINO_RAMAL_TYPE,
  NORMAL_CLIENT_RAMAL_TYPES,
  nextId,
  numberFromInput,
} from './BtTopologyPanelUtils';
import { useBtTopologyContext } from './BtTopologyContext';

const RAMAL_QUICK_NOTES: Array<{
  value: string;
  labelKey: 'deteriorated' | 'splices' | 'noInsulation' | 'long' | 'crossing' | 'other';
}> = [
  { value: 'deteriorado', labelKey: 'deteriorated' },
  { value: 'emendas', labelKey: 'splices' },
  { value: 'sem_isolamento', labelKey: 'noInsulation' },
  { value: 'ramal_longo', labelKey: 'long' },
  { value: 'cruzamento', labelKey: 'crossing' },
  { value: 'outro', labelKey: 'other' },
];

const BtUnifiedCommercialTab: React.FC = () => {
  const {
    locale,
    projectType,
    selectedPole: pole,
    accumulatedByPole,
    updatePoleRamais,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale);
  const pt = t.poleVerification;
  const dashboardText = t.dashboard;
  const isClandestino = projectType === 'clandestino';

  if (!pole) return null;

  const poleDemand = accumulatedByPole.find(d => d.poleId === pole.id);
  const ramais = pole.ramais ?? [];

  const handleAddRamal = () => {
    const defaultRamalType = isClandestino ? CLANDESTINO_RAMAL_TYPE : NORMAL_CLIENT_RAMAL_TYPES[0];

    updatePoleRamais(pole.id, [
      ...ramais,
      { id: nextId('RP'), quantity: 1, ramalType: defaultRamalType },
    ]);
  };

  const handleUpdateRamal = (id: string, updates: Partial<BtPoleRamalEntry>) => {
    updatePoleRamais(
      pole.id,
      ramais.map(r => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleRemoveRamal = (id: string) => {
    updatePoleRamais(
      pole.id,
      ramais.filter(r => r.id !== id)
    );
  };

  return (
    <div className="space-y-4 pb-6">
      {/* SECTION: Stats / Demand */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm dark:bg-zinc-900/40 dark:border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <TrendingUp size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
            {dashboardText.loadStatisticsTitle}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center dark:bg-emerald-950/10 dark:border-emerald-900/20">
            <Users
              size={14}
              className="mx-auto mb-1 text-emerald-600 opacity-50 dark:text-emerald-400"
            />
            <div className="text-[14px] font-black text-emerald-800 leading-none dark:text-emerald-300">
              {poleDemand?.accumulatedClients ?? 0}
            </div>
            <div className="text-[8px] font-black uppercase tracking-tighter text-emerald-600 mt-1 dark:text-emerald-500">
              {dashboardText.clientsLabel}
            </div>
          </div>
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center dark:bg-blue-950/10 dark:border-blue-900/20">
            <Activity
              size={14}
              className="mx-auto mb-1 text-blue-600 opacity-50 dark:text-blue-400"
            />
            <div className="text-[14px] font-black text-blue-800 leading-none dark:text-blue-300">
              {poleDemand?.accumulatedDemandKva?.toFixed(2) ?? '0.00'}
            </div>
            <div className="text-[8px] font-black uppercase tracking-tighter text-blue-600 mt-1 dark:text-blue-500">
              {dashboardText.demandKvaLabel}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Ramais */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 shadow-sm dark:bg-zinc-900/40 dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
              <ShoppingCart size={16} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
              {isClandestino ? 'Clientes Clandestinos' : pt.ramaisTitle}
            </h3>
          </div>
          {!isClandestino && (
            <button
              onClick={handleAddRamal}
              title={pt.addRamal}
              aria-label={pt.addRamal}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm active:scale-95 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              <Plus size={16} />
            </button>
          )}
          {isClandestino && ramais.length === 0 && (
            <button
              onClick={handleAddRamal}
              title="Iniciar carga"
              aria-label="Iniciar carga"
              className="px-3 py-1 bg-violet-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-violet-700 transition-all shadow-sm active:scale-95 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              Iniciar Carga
            </button>
          )}
        </div>

        {ramais.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center dark:bg-zinc-950 dark:text-slate-500 dark:border-white/5">
            {isClandestino ? 'Nenhuma carga informada para este poste.' : pt.noRamais}
          </div>
        ) : (
          <div className="space-y-4">
            {ramais.map(ramal => (
              <div
                key={ramal.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 dark:bg-zinc-950 dark:border-white/5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase mb-1 dark:text-slate-500">
                        {dashboardText.clientsQtyLabel}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={ramal.quantity}
                        onChange={e =>
                          handleUpdateRamal(ramal.id, {
                            quantity: Math.max(1, numberFromInput(e.target.value)),
                          })
                        }
                        title={dashboardText.clientsQtyLabel}
                        aria-label={dashboardText.clientsQtyLabel}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-black text-center focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-900 dark:border-white/5 dark:text-slate-200 dark:focus:ring-violet-900/40"
                      />
                    </div>
                    {!isClandestino ? (
                      <div className="flex flex-col flex-[2]">
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-1 dark:text-slate-500">
                          {dashboardText.connectionTypeLabel}
                        </span>
                        <select
                          value={ramal.ramalType ?? NORMAL_CLIENT_RAMAL_TYPES[0]}
                          onChange={e => handleUpdateRamal(ramal.id, { ramalType: e.target.value })}
                          title={dashboardText.connectionTypeLabel}
                          aria-label={dashboardText.connectionTypeLabel}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-zinc-900 dark:border-white/5 dark:text-slate-200 dark:focus:ring-indigo-900/40"
                        >
                          {NORMAL_CLIENT_RAMAL_TYPES.map(t => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-[2]">
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-1 dark:text-slate-500">
                          {dashboardText.categoryLabel}
                        </span>
                        <div className="p-1.5 bg-violet-100 text-violet-700 text-xs font-black rounded border border-violet-200 text-center dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/20">
                          {dashboardText.categoryClandestine}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveRamal(ramal.id)}
                    title={pt.removeRamal}
                    aria-label={pt.removeRamal}
                    className="p-1.5 mt-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all dark:hover:bg-rose-950/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {!isClandestino && (
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/5">
                    <div className="flex flex-wrap gap-1">
                      {RAMAL_QUICK_NOTES.map(chip => {
                        const label = pt.quickNotes[chip.labelKey];
                        const isActive = ramal.notes === label;
                        return (
                          <button
                            key={chip.value}
                            onClick={() =>
                              handleUpdateRamal(ramal.id, { notes: isActive ? undefined : label })
                            }
                            className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border transition-all ${
                              isActive
                                ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 dark:bg-zinc-900 dark:border-white/5 dark:text-slate-500 dark:hover:text-slate-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative">
                      <Tag
                        size={10}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"
                      />
                      <input
                        type="text"
                        value={ramal.notes ?? ''}
                        onChange={e =>
                          handleUpdateRamal(ramal.id, { notes: e.target.value || undefined })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-6 pr-2 text-xs placeholder:opacity-30 dark:bg-zinc-900 dark:border-white/5 dark:text-slate-200"
                        placeholder={pt.freeObservation}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BtUnifiedCommercialTab;
