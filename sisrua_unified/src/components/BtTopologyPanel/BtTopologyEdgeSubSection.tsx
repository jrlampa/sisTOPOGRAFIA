import React from 'react';
import { Plus, Trash2, Zap, Activity, Weight, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CONDUCTOR_NAMES,
  MT_CONDUCTOR_NAMES,
  getEdgeChangeFlag,
  nextId,
} from './BtTopologyPanelUtils';
import { useBtTopologyContext } from './BtTopologyContext';
import { listConductorsByCategory } from '../../services/conductorCatalogRepository';
import type { ConductorCatalogEntry } from '../../types.canonical';

// Simulação de dados mecânicos para feedback na UI (Deve ser sincronizado com o backend futuramente)
const MEC_DATA: Record<string, { traction: number; weight: number }> = {
  '70 Al - MX': { traction: 200, weight: 0.85 },
  '35 Al - MX': { traction: 110, weight: 0.45 },
  '120 Al - MX': { traction: 350, weight: 1.45 },
  '185 Al - MX': { traction: 520, weight: 2.2 },
  'MT-4-AWG-AL': { traction: 150, weight: 0.15 },
  'MT-70-PROT': { traction: 250, weight: 0.9 },
};

const BtTopologyEdgeSubSection: React.FC = () => {
  const {
    btTopology,
    selectedEdge,
    selectedEdgeId,
    onSelectedEdgeChange: selectEdge,
    updateEdgeConductors,
    updateEdgeMtConductors,
    onBtSetEdgeChangeFlag,
  } = useBtTopologyContext();

  const [btConductorNames, setBtConductorNames] = React.useState<string[]>(CONDUCTOR_NAMES);
  const [mtConductorNames, setMtConductorNames] = React.useState<string[]>(MT_CONDUCTOR_NAMES);
  const [catalogByConductor, setCatalogByConductor] = React.useState<
    Record<string, ConductorCatalogEntry>
  >({});

  React.useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      const [btCatalog, mtCatalog] = await Promise.all([
        listConductorsByCategory('BT'),
        listConductorsByCategory('MT'),
      ]);

      if (!active) return;

      if (btCatalog.length > 0) {
        setBtConductorNames(btCatalog.map(item => item.conductorId));
      }
      if (mtCatalog.length > 0) {
        setMtConductorNames(mtCatalog.map(item => item.conductorId));
      }

      const nextCatalog: Record<string, ConductorCatalogEntry> = {};
      for (const item of [...btCatalog, ...mtCatalog]) {
        nextCatalog[item.conductorId] = item;
      }
      setCatalogByConductor(nextCatalog);
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  if (!selectedEdge) return null;

  const allCircuits = [
    ...(selectedEdge.conductors || []).map(c => ({
      ...c,
      type: 'BT' as const,
    })),
    ...(selectedEdge.mtConductors || []).map(c => ({
      ...c,
      type: 'MT' as const,
    })),
  ];

  const totalTraction = allCircuits.reduce((acc, c) => {
    const tractionFromCatalog = catalogByConductor[c.conductorName]?.tensileStrengthDan;
    const traction = tractionFromCatalog ?? MEC_DATA[c.conductorName]?.traction ?? 200;
    return acc + traction * c.quantity;
  }, 0);
  const totalWeight = allCircuits.reduce((acc, c) => {
    const weightFromCatalog = catalogByConductor[c.conductorName]?.weightKgPerKm;
    const weightDanM =
      weightFromCatalog !== undefined
        ? weightFromCatalog / 1000
        : (MEC_DATA[c.conductorName]?.weight ?? 0.85);
    return acc + weightDanM * c.quantity;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Vão Selector & Flags */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm dark:bg-zinc-900/50 dark:border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 dark:bg-zinc-950 dark:text-slate-400">
            <ArrowRightLeft size={14} />
          </div>
          <select
            className="flex-1 bg-transparent border-none p-0 text-xs font-black text-slate-800 focus:ring-0 dark:text-slate-100"
            value={selectedEdgeId}
            title="Selecionar vão"
            aria-label="Selecionar vão"
            onChange={e => selectEdge(e.target.value)}
          >
            {btTopology.edges.map(e => (
              <option key={e.id} value={e.id} className="dark:bg-slate-900">
                VÃO: {e.fromPoleId} → {e.toPoleId}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {(['existing', 'new', 'replace', 'remove'] as const).map(flag => (
            <button
              key={flag}
              onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, flag)}
              className={`flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-tighter border transition-all ${
                getEdgeChangeFlag(selectedEdge) === flag
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100 dark:bg-zinc-950 dark:text-slate-500 dark:hover:bg-zinc-900'
              }`}
            >
              {flag === 'existing'
                ? 'Mant.'
                : flag === 'new'
                  ? 'Inst.'
                  : flag === 'replace'
                    ? 'Subst.'
                    : 'Sucata'}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Circuit List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">
            Circuitos no Vão
          </span>
          <div className="flex gap-1">
            <button
              onClick={() =>
                updateEdgeConductors(selectedEdge.id, [
                  ...selectedEdge.conductors,
                  {
                    id: nextId('C'),
                    quantity: 1,
                    conductorName: btConductorNames[0] ?? CONDUCTOR_NAMES[0],
                  },
                ])
              }
              className="p-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400"
              title="Adicionar Circuito BT"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={() =>
                updateEdgeMtConductors?.(selectedEdge.id, [
                  ...(selectedEdge.mtConductors || []),
                  {
                    id: nextId('MT'),
                    quantity: 1,
                    conductorName: mtConductorNames[0] ?? MT_CONDUCTOR_NAMES[0],
                  },
                ])
              }
              className="p-1 bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors dark:bg-amber-900/30 dark:text-amber-400"
              title="Adicionar Circuito MT"
            >
              <Zap size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {allCircuits.map(c => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`group flex items-center gap-2 p-2 rounded-xl border transition-all ${
                  c.type === 'MT'
                    ? 'bg-amber-50/30 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30'
                    : 'bg-white border-slate-100 dark:bg-zinc-900/40 dark:border-white/5'
                }`}
              >
                <div
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${
                    c.type === 'MT'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                  }`}
                >
                  {c.type}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-bold text-slate-700 truncate dark:text-slate-300">
                    {c.quantity}x {c.conductorName}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 opacity-60">
                    <span className="flex items-center gap-0.5 text-[8px] font-bold dark:text-slate-400">
                      <Activity size={8} />{' '}
                      {(catalogByConductor[c.conductorName]?.tensileStrengthDan ??
                        MEC_DATA[c.conductorName]?.traction ??
                        0) * c.quantity}{' '}
                      daN
                    </span>
                    <span className="flex items-center gap-0.5 text-[8px] font-bold dark:text-slate-400">
                      <Weight size={8} />{' '}
                      {(() => {
                        const catalogWeight = catalogByConductor[c.conductorName]?.weightKgPerKm;
                        const value =
                          catalogWeight !== undefined
                            ? catalogWeight / 1000
                            : (MEC_DATA[c.conductorName]?.weight ?? 0);
                        return value.toFixed(2);
                      })()}{' '}
                      daN/m
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (c.type === 'BT') {
                      updateEdgeConductors(
                        selectedEdge.id,
                        selectedEdge.conductors.filter(item => item.id !== c.id)
                      );
                    } else {
                      updateEdgeMtConductors?.(
                        selectedEdge.id,
                        (selectedEdge.mtConductors || []).filter(item => item.id !== c.id)
                      );
                    }
                  }}
                  title="Remover circuito"
                  aria-label="Remover circuito"
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 dark:hover:bg-rose-950/20"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Aggregated Span Summary */}
      <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative dark:bg-zinc-950 dark:border dark:border-white/5">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity size={48} />
        </div>
        <div className="relative z-10">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            Resumo de Esforço do Vão
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">
                Tração Total
              </div>
              <div className="text-sm font-black text-blue-400">
                {totalTraction} <small className="text-[10px] opacity-70">daN</small>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">
                Peso Estimado
              </div>
              <div className="text-sm font-black text-emerald-400">
                {totalWeight.toFixed(2)} <small className="text-[10px] opacity-70">daN/m</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BtTopologyEdgeSubSection;
