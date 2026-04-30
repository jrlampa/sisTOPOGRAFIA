import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';

export type ConfirmationVariant = 'danger' | 'info' | 'warning';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: ConfirmationVariant;
}

export function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
    variant = 'info'
}: ConfirmationModalProps) {
    const variantConfig = {
        danger: {
            icon: <AlertTriangle className="text-rose-500" size={24} />,
            border: 'border-rose-500/30',
            button: 'bg-rose-600 hover:bg-rose-500 border-rose-600',
            bg: 'bg-rose-500/5'
        },
        warning: {
            icon: <AlertTriangle className="text-amber-500" size={24} />,
            border: 'border-amber-500/30',
            button: 'bg-amber-600 hover:bg-amber-500 border-amber-600',
            bg: 'bg-amber-500/5'
        },
        info: {
            icon: <Info className="text-blue-500" size={24} />,
            border: 'border-blue-500/30',
            button: 'bg-blue-600 hover:bg-blue-500 border-blue-600',
            bg: 'bg-blue-500/5'
        }
    };

    const config = variantConfig[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative w-full max-w-sm overflow-hidden rounded-2xl border ${config.border} bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors duration-300`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`shrink-0 rounded-xl ${config.bg} p-2.5`}>
                                {config.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                    {message}
                                </p>
                            </div>
                            <button
                                onClick={onCancel}
                                className="flex h-11 w-11 items-center justify-center -mr-2 -mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title={cancelLabel}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mt-8 flex items-center justify-end gap-3">
                            <button
                                onClick={onCancel}
                                className="rounded-xl border border-slate-200 border-b-2 bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`rounded-xl border-b-2 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 ${config.button}`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
