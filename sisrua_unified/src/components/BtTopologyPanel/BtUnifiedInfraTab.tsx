import React from 'react';
import { FileText, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBtTopologyPanelText } from '../../i18n/btTopologyPanelText';
import type { BtPoleConditionStatus } from '../../types';
import PoleCockpitCard from './Cockpit/PoleCockpitCard';
import { useBtTopologyContext } from './BtTopologyContext';
import { fadeSlideUp, scaleIn } from '../../theme/motion';

const BtUnifiedInfraTab: React.FC = () => {
  const {
    locale,
    selectedPole: pole,
    accumulatedByPole,
    mtTopology,
    onBtRenamePole,
    onBtSetPoleChangeFlag,
    updatePoleSpec,
    updatePoleConditionStatus,
    updatePoleBtStructures,
    updatePoleGeneralNotes,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale);
  const pt = t.poleVerification;
  const dashboardText = t.dashboard;

  if (!pole) return null;

  const accData = accumulatedByPole.find(a => a.poleId === pole.id);

  // Mocks de resultados dos motores recém-criados para visualização imediata no Cockpit
  const mechanicalResult = accData
    ? {
        resultantForceDaN: Math.round(Math.random() * 450), // Simulando motor 2.5D
        overloaded: Math.random() > 0.8,
        resultantAngleDegrees: 45,
      }
    : undefined;

  const accessibilityCost =
    pole.hasVehicleAccess === false
      ? (pole.manualDragDistanceMeters || 0) * 0.005 * 500 // Simulando AccessibilityProcessor
      : 0;

  // Extrair estruturas de MT para o cockpit
  const mtPole = mtTopology.poles.find(p => p.id === pole.id);
  const mtStructures = mtPole ? Object.values(mtPole.mtStructures || {}).filter(Boolean) : [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } },
      }}
      className="space-y-4 pb-6"
    >
      <motion.div variants={scaleIn}>
        <PoleCockpitCard
          key={pole.id}
          pole={pole}
          mtStructures={mtStructures}
          locale={locale}
          onRename={(id, title) => onBtRenamePole?.(id, title)}
          onSetFlag={(id, flag) => onBtSetPoleChangeFlag?.(id, flag)}
          onUpdateSpec={(id, spec) => updatePoleSpec(id, spec)}
          onUpdateAcessibilidade={() => {}}
          mechanicalResult={mechanicalResult}
          accessibilityCost={accessibilityCost}
        />
      </motion.div>

      {/* Physical State & Structures */}
      <motion.div
        variants={fadeSlideUp}
        className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-slate-200 shadow-sm space-y-4 dark:bg-zinc-900/40 dark:border-white/5"
      >
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-2 dark:text-slate-500">
            {pt.poleStateTitle}
          </label>
          <select
            value={pole.conditionStatus ?? ''}
            onChange={e =>
              updatePoleConditionStatus(
                pole.id,
                (e.target.value || undefined) as BtPoleConditionStatus | undefined
              )
            }
            title={pt.poleStateTitle}
            aria-label={pt.poleStateTitle}
            className="w-full bg-slate-50 border-none rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100 dark:bg-zinc-950 dark:text-slate-200 dark:focus:ring-blue-900/20"
          >
            <option value="">{pt.selectState}</option>
            <option value="bom_estado">{pt.stateGood}</option>
            <option value="projetado">{pt.stateProjected}</option>
            <option value="desaprumado">{pt.stateLeaning}</option>
            <option value="trincado">{pt.stateCracked}</option>
            <option value="condenado">{pt.stateCondemned}</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-2 dark:text-slate-500">
            {pt.structuresTitle}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['si1', 'si2', 'si3', 'si4'] as const).map(slot => (
              <input
                key={slot}
                type="text"
                placeholder={slot.toUpperCase()}
                value={pole.btStructures?.[slot] ?? ''}
                onChange={e =>
                  updatePoleBtStructures(pole.id, {
                    ...pole.btStructures,
                    [slot]: e.target.value || undefined,
                  })
                }
                className="bg-slate-50 border-none rounded-xl p-2.5 text-xs font-mono font-bold text-slate-700 placeholder:opacity-30 focus:ring-2 focus:ring-blue-100 dark:bg-zinc-950 dark:text-slate-200 dark:focus:ring-blue-900/20"
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Notes */}
      <motion.div
        variants={fadeSlideUp}
        className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-slate-200 shadow-sm dark:bg-zinc-900/40 dark:border-white/5"
      >
        <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 mb-2 dark:text-slate-500">
          <FileText size={12} /> {pt.generalNotesTitle}
        </label>
        <textarea
          value={pole.generalNotes ?? ''}
          onChange={e => updatePoleGeneralNotes(pole.id, e.target.value || undefined)}
          rows={3}
          className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 resize-none dark:bg-zinc-950 dark:text-slate-200 dark:focus:ring-blue-900/20"
          placeholder={pt.generalNotesPlaceholder}
        />
      </motion.div>

      {/* MT Context (Unified Vision) */}
      {mtTopology.poles.some(p => p.id === pole.id) && (
        <motion.div
          variants={fadeSlideUp}
          className="bg-gradient-to-br from-amber-50 to-orange-100/50 border border-orange-200 rounded-3xl p-4 shadow-sm dark:from-amber-950/20 dark:to-orange-950/20 dark:border-orange-900/30"
        >
          <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-700/60 mb-3 dark:text-orange-400/60">
            <Zap size={12} /> {dashboardText.mediumVoltageContext}
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-white/60 p-2.5 rounded-xl border border-orange-200/30 dark:bg-zinc-950/40 dark:border-white/5">
              <span className="text-xs font-bold text-orange-900/70 uppercase dark:text-orange-200/70">
                {dashboardText.mediumVoltageStructures}
              </span>
              <span className="text-xs font-mono font-bold text-orange-800 dark:text-orange-400">
                {(() => {
                  const mtPole = mtTopology.poles.find(p => p.id === pole.id);
                  if (!mtPole?.mtStructures) return dashboardText.notAvailable;
                  return Object.values(mtPole.mtStructures).filter(Boolean).join(' / ');
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center bg-white/60 p-2.5 rounded-xl border border-orange-200/30 dark:bg-zinc-950/40 dark:border-white/5">
              <span className="text-xs font-bold text-orange-900/70 uppercase dark:text-orange-200/70">
                {dashboardText.mediumVoltageConnections}
              </span>
              <span className="text-xs font-mono font-bold text-orange-800 dark:text-orange-400">
                {dashboardText.spansCount(
                  mtTopology.edges.filter(e => e.fromPoleId === pole.id || e.toPoleId === pole.id)
                    .length
                )}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default BtUnifiedInfraTab;
