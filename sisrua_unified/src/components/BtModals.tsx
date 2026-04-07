import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NORMAL_CLIENT_RAMAL_TYPES, PendingNormalClassificationPole } from '../constants/btConstants';

interface NormalRamalModalState {
  poleId: string;
  poleTitle: string;
  ramalType: string;
  quantity: number;
}

interface BtModalsProps {
  normalRamalModal: NormalRamalModalState | null;
  setNormalRamalModal: (modal: NormalRamalModalState | null) => void;
  onConfirmNormalRamalModal: () => void;
  clandestinoToNormalModal: { poles: PendingNormalClassificationPole[] } | null;
  setClandestinoToNormalModal: (modal: { poles: PendingNormalClassificationPole[] } | null) => void;
  onClandestinoToNormalClassifyLater: () => void;
  onClandestinoToNormalConvertNow: () => void;
  normalToClandestinoModal: { totalNormalClients: number } | null;
  setNormalToClandestinoModal: (modal: { totalNormalClients: number } | null) => void;
  onNormalToClandestinoKeepClients: () => void;
  onNormalToClandestinoZeroNormalClients: () => void;
}

const BtModals: React.FC<BtModalsProps> = ({
  normalRamalModal, setNormalRamalModal, onConfirmNormalRamalModal,
  clandestinoToNormalModal, setClandestinoToNormalModal,
  onClandestinoToNormalClassifyLater, onClandestinoToNormalConvertNow,
  normalToClandestinoModal, setNormalToClandestinoModal,
  onNormalToClandestinoKeepClients, onNormalToClandestinoZeroNormalClients
}) => (
  <>
    <AnimatePresence>
      {normalRamalModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[980] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-4 shadow-2xl"
          >
            <div className="text-sm font-semibold text-slate-800">Ramal do cliente</div>
            <div className="mt-1 text-xs text-slate-500">{normalRamalModal.poleTitle}</div>
            <div className="mt-3 space-y-2">
              <label className="text-xs text-slate-600 block">Tipo de ramal</label>
              <select
                aria-label="Tipo de ramal"
                value={normalRamalModal.ramalType}
                onChange={(e) => setNormalRamalModal({ ...normalRamalModal, ramalType: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800"
              >
                {NORMAL_CLIENT_RAMAL_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <label className="text-xs text-slate-600 block">Quantidade</label>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Quantidade de ramais"
                value={normalRamalModal.quantity === 0 ? '' : String(normalRamalModal.quantity)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const n = parseInt(raw, 10);
                  setNormalRamalModal({ ...normalRamalModal, quantity: Number.isFinite(n) && n > 0 ? n : 0 });
                }}
                className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setNormalRamalModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmNormalRamalModal}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Adicionar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {clandestinoToNormalModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[985] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-2xl rounded-xl border border-amber-300 bg-white p-5 shadow-2xl"
          >
            <div className="text-base font-semibold text-slate-900">Atenção: mudança Clandestino → Normal</div>
            <p className="mt-1 text-sm text-slate-600">
              Identifique os tipos de ramal dos postes abaixo para cálculo normal. Você pode migrar tudo agora como Monofásico ou fazer depois.
            </p>
            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Poste</th>
                    <th className="px-3 py-2 font-semibold">Clientes clandestinos</th>
                  </tr>
                </thead>
                <tbody>
                  {clandestinoToNormalModal.poles.map((entry) => (
                    <tr key={entry.poleId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">{entry.poleTitle}</td>
                      <td className="px-3 py-2 text-slate-700">{entry.clandestinoClients}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setClandestinoToNormalModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onClandestinoToNormalClassifyLater}
                className="rounded border border-amber-500 bg-amber-500 px-3 py-1.5 text-xs text-white hover:bg-amber-400"
              >
                Fazer Depois (Bloquear DXF)
              </button>
              <button
                onClick={onClandestinoToNormalConvertNow}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Migrar Agora como Monofásico
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {normalToClandestinoModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[985] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-5 shadow-2xl"
          >
            <div className="text-base font-semibold text-slate-900">Mudança Normal → Clandestino</div>
            <p className="mt-1 text-sm text-slate-600">
              Há {normalToClandestinoModal.totalNormalClients} cliente(s) normal(is) cadastrados. Deseja manter para possível retorno ou zerar somente os normais?
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setNormalToClandestinoModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onNormalToClandestinoKeepClients}
                className="rounded border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
              >
                Manter Clientes
              </button>
              <button
                onClick={onNormalToClandestinoZeroNormalClients}
                className="rounded border border-rose-500 bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500"
              >
                Zerar Só Normais
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

export default BtModals;
