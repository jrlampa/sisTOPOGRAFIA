import { AnimatePresence, motion } from "framer-motion";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import { NORMAL_CLIENT_RAMAL_TYPES } from "../utils/btNormalization";
import type { PendingNormalClassificationPole } from "../utils/btNormalization";
import { getPositiveIntegerFeedback } from "../utils/validation";

export interface CriticalConfirmationConfig {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel?: () => void;
}

// ── NormalRamalModal ──────────────────────────────────────────────────────────

interface NormalRamalModalState {
  poleId: string;
  poleTitle: string;
  ramalType: string;
  quantity: number;
}

interface NormalRamalModalProps {
  modal: NormalRamalModalState | null;
  setModal: (m: NormalRamalModalState | null) => void;
  onConfirm: () => void;
}

export function NormalRamalModal({
  modal,
  setModal,
  onConfirm,
}: NormalRamalModalProps) {
  const quantityValidation = getPositiveIntegerFeedback(
    modal?.quantity ?? 0,
    "uma quantidade",
  );

  return (
    <AnimatePresence>
      {modal && (
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
            <div className="text-sm font-semibold text-slate-800">
              Ramal do cliente
            </div>
            <div className="mt-1 text-xs text-slate-500">{modal.poleTitle}</div>

            <div className="mt-3 space-y-2">
              <label className="text-xs text-slate-600 block">
                Tipo de ramal
              </label>
              <select
                aria-label="Tipo de ramal"
                value={modal.ramalType}
                onChange={(e) =>
                  setModal({ ...modal, ramalType: e.target.value })
                }
                className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800"
              >
                {NORMAL_CLIENT_RAMAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <label className="text-xs text-slate-600 block">Quantidade</label>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Quantidade de ramais"
                aria-describedby="normal-ramal-quantity-feedback"
                value={modal.quantity === 0 ? "" : String(modal.quantity)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const n = parseInt(raw, 10);
                  setModal({
                    ...modal,
                    quantity: Number.isFinite(n) && n > 0 ? n : 0,
                  });
                }}
                className={`w-full rounded border bg-white p-2 text-sm focus:outline-none focus:ring-2 ${getValidationInputClassName(quantityValidation.state, "light")}`}
              />
              <FormFieldMessage
                id="normal-ramal-quantity-feedback"
                palette="light"
                tone={quantityValidation.state}
                message={quantityValidation.message}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={!quantityValidation.isValid}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Adicionar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ClandestinoToNormalModal ──────────────────────────────────────────────────

interface ClandestinoToNormalModalProps {
  modal: { poles: PendingNormalClassificationPole[] } | null;
  setModal: (m: null) => void;
  onClassifyLater: () => void;
  onConvertNow: () => void;
}

export function ClandestinoToNormalModal({
  modal,
  setModal,
  onClassifyLater,
  onConvertNow,
}: ClandestinoToNormalModalProps) {
  return (
    <AnimatePresence>
      {modal && (
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
            <div className="text-base font-semibold text-slate-900">
              Atenção: mudança Clandestino → Normal
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Identifique os tipos de ramal dos postes abaixo para cálculo
              normal. Você pode migrar tudo agora como Monofásico ou fazer
              depois.
            </p>

            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Poste</th>
                    <th className="px-3 py-2 font-semibold">
                      Clientes clandestinos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modal.poles.map((entry) => (
                    <tr
                      key={entry.poleId}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-800">
                        {entry.poleTitle}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {entry.clandestinoClients}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onClassifyLater}
                className="rounded border border-amber-500 bg-amber-500 px-3 py-1.5 text-xs text-white hover:bg-amber-400"
              >
                Fazer Depois (Bloquear DXF)
              </button>
              <button
                onClick={onConvertNow}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Migrar Agora como Monofásico
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── NormalToClandestinoModal ──────────────────────────────────────────────────

interface NormalToClandestinoModalProps {
  modal: { totalNormalClients: number } | null;
  setModal: (m: null) => void;
  onKeepClients: () => void;
  onZeroNormalClients: () => void;
}

export function NormalToClandestinoModal({
  modal,
  setModal,
  onKeepClients,
  onZeroNormalClients,
}: NormalToClandestinoModalProps) {
  return (
    <AnimatePresence>
      {modal && (
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
            <div className="text-base font-semibold text-slate-900">
              Mudança Normal → Clandestino
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Há {modal.totalNormalClients} cliente(s) normal(is) cadastrados.
              Deseja manter para possível retorno ou zerar somente os normais?
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onKeepClients}
                className="rounded border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
              >
                Manter Clientes
              </button>
              <button
                onClick={onZeroNormalClients}
                className="rounded border border-rose-500 bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500"
              >
                Zerar Só Normais
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ResetBtTopologyModal ──────────────────────────────────────────────────────

interface ResetBtTopologyModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetBtTopologyModal({
  open,
  onConfirm,
  onCancel,
}: ResetBtTopologyModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[990] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-sm rounded-xl border border-rose-400 bg-white p-5 shadow-2xl"
          >
            <div className="text-base font-semibold text-slate-900">
              Zerar topologia BT?
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Isso removerá todos os postes, condutores, trafos e todo o
              histórico BT. A ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="rounded border border-rose-500 bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500"
              >
                Zerar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CriticalActionModalProps {
  modal: CriticalConfirmationConfig | null;
  onClose: () => void;
}

export function CriticalActionModal({
  modal,
  onClose,
}: CriticalActionModalProps) {
  const tone = modal?.tone ?? "warning";

  const toneClassName =
    tone === "danger"
      ? "border-rose-400 bg-rose-600 text-white hover:bg-rose-500"
      : tone === "info"
        ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
        : "border-amber-500 bg-amber-500 text-white hover:bg-amber-400";

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[995] flex items-center justify-center bg-black/55 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-5 shadow-2xl"
          >
            <div className="text-base font-semibold text-slate-900">
              {modal.title}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
              {modal.message}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  modal.onCancel?.();
                  onClose();
                }}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                {modal.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => {
                  modal.onConfirm();
                  onClose();
                }}
                className={`rounded border px-3 py-1.5 text-xs ${toneClassName}`}
              >
                {modal.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
