import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Info,
  Trash2,
  Users,
} from "lucide-react";
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
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!modal) return;
    selectRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, setModal]);

  const quantityValidation = getPositiveIntegerFeedback(
    modal?.quantity ?? 0,
    "uma quantidade",
  );

  return (
    <AnimatePresence>
      {modal && (
        <div className="fixed inset-0 z-[980] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="normal-ramal-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm rounded-2xl border border-blue-500/20 bg-white dark:bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-blue-500/10 p-2.5">
                <Users size={20} className="text-blue-500" />
              </div>
              <div>
                <h2
                  id="normal-ramal-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Ramal do cliente
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {modal.poleTitle}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Tipo de ramal
                </label>
                <select
                  ref={selectRef}
                  aria-label="Tipo de ramal"
                  value={modal.ramalType}
                  onChange={(e) =>
                    setModal({ ...modal, ramalType: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
                >
                  {NORMAL_CLIENT_RAMAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Quantidade
                </label>
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
                  className={`w-full rounded-xl border bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-100 focus:outline-none focus:ring-2 transition-colors ${getValidationInputClassName(quantityValidation.state, "light")}`}
                />
                <FormFieldMessage
                  id="normal-ramal-quantity-feedback"
                  palette="light"
                  tone={quantityValidation.state}
                  message={quantityValidation.message}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={!quantityValidation.isValid}
                className="rounded-xl border border-blue-500 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </motion.div>
        </div>
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
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modal) return;
    firstBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, setModal]);

  return (
    <AnimatePresence>
      {modal && (
        <div className="fixed inset-0 z-[985] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clandestino-to-normal-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-white dark:bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-amber-500/10 p-2.5">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h2
                  id="clandestino-to-normal-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Atenção: mudança Clandestino → Normal
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Identifique os tipos de ramal dos postes abaixo para cálculo
                  normal. Você pode migrar tudo agora como Monofásico ou fazer
                  depois.
                </p>
              </div>
            </div>

            <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
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
                      className="border-t border-slate-100 dark:border-white/5"
                    >
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                        {entry.poleTitle}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {entry.clandestinoClients}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                ref={firstBtnRef}
                onClick={onClassifyLater}
                className="rounded-xl border border-amber-500 bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
              >
                Fazer Depois (Bloquear DXF)
              </button>
              <button
                onClick={onConvertNow}
                className="rounded-xl border border-blue-500 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Migrar Agora como Monofásico
              </button>
            </div>
          </motion.div>
        </div>
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
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modal) return;
    firstBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, setModal]);

  return (
    <AnimatePresence>
      {modal && (
        <div className="fixed inset-0 z-[985] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="normal-to-clandestino-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-white dark:bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-amber-500/10 p-2.5">
                <ArrowLeftRight size={20} className="text-amber-500" />
              </div>
              <div>
                <h2
                  id="normal-to-clandestino-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Mudança Normal → Clandestino
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Há {modal.totalNormalClients} cliente(s) normal(is)
                  cadastrados. Deseja manter para possível retorno ou zerar
                  somente os normais?
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                ref={firstBtnRef}
                onClick={onKeepClients}
                className="rounded-xl border border-indigo-500 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Manter Clientes
              </button>
              <button
                onClick={onZeroNormalClients}
                className="rounded-xl border border-rose-500 bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
              >
                Zerar Só Normais
              </button>
            </div>
          </motion.div>
        </div>
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[990] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-bt-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm rounded-2xl border border-rose-500/30 bg-white dark:bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-rose-500/10 p-2.5">
                <Trash2 size={20} className="text-rose-500" />
              </div>
              <div>
                <h2
                  id="reset-bt-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Zerar topologia BT?
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Isso removerá todos os postes, condutores, trafos e todo o
                  histórico BT. A ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="rounded-xl border border-rose-500 bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
              >
                Zerar
              </button>
            </div>
          </motion.div>
        </div>
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const tone = modal?.tone ?? "warning";

  useEffect(() => {
    if (!modal) return;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        modal.onCancel?.();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, onClose]);

  const toneConfig = {
    danger: {
      border: "border-rose-500/30",
      iconBg: "bg-rose-500/10",
      icon: <AlertTriangle size={20} className="text-rose-500" />,
      btn: "border-rose-500 bg-rose-600 hover:bg-rose-500",
    },
    warning: {
      border: "border-amber-500/30",
      iconBg: "bg-amber-500/10",
      icon: <AlertTriangle size={20} className="text-amber-500" />,
      btn: "border-amber-500 bg-amber-500 hover:bg-amber-400",
    },
    info: {
      border: "border-blue-500/30",
      iconBg: "bg-blue-500/10",
      icon: <Info size={20} className="text-blue-500" />,
      btn: "border-blue-500 bg-blue-600 hover:bg-blue-500",
    },
  };

  const config = toneConfig[tone];

  return (
    <AnimatePresence>
      {modal && (
        <div className="fixed inset-0 z-[995] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              modal.onCancel?.();
              onClose();
            }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="critical-action-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-md rounded-2xl border ${config.border} bg-white dark:bg-slate-900 p-5 shadow-2xl`}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className={`shrink-0 rounded-xl ${config.iconBg} p-2.5`}>
                {config.icon}
              </div>
              <div>
                <h2
                  id="critical-action-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  {modal.title}
                </h2>
                <p className="mt-0.5 whitespace-pre-line text-sm text-slate-500 dark:text-slate-400">
                  {modal.message}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                ref={cancelRef}
                onClick={() => {
                  modal.onCancel?.();
                  onClose();
                }}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                {modal.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => {
                  modal.onConfirm();
                  onClose();
                }}
                className={`rounded-xl border ${config.btn} px-4 py-2 text-xs font-semibold text-white transition-colors`}
              >
                {modal.confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
