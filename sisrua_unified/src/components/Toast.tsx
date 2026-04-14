import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'alert';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const icons = {
        success: <CheckCircle2 className="text-emerald-400" size={20} />,
        error: <AlertCircle className="text-rose-400" size={20} />,
        info: <Info className="text-sky-400" size={20} />,
        warning: <AlertTriangle className="text-amber-400" size={20} />,
        alert: <AlertTriangle className="text-orange-400" size={20} />
    };

    const borderColors = {
        success: 'border-emerald-500/30',
        error: 'border-rose-500/30',
        info: 'border-sky-500/30',
        warning: 'border-amber-500/30',
        alert: 'border-orange-500/30'
    };

    const bgColors = {
        success: 'bg-emerald-500/5',
        error: 'bg-rose-500/5',
        info: 'bg-sky-500/5',
        warning: 'bg-amber-500/5',
        alert: 'bg-orange-500/5'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
            role="alert"
            aria-live="polite"
            className={`fixed top-4 right-4 z-[1000] flex items-center gap-4 p-4 rounded-2xl border ${borderColors[type]} ${bgColors[type]} max-w-sm w-[calc(100vw-2rem)] md:w-full transition-colors shadow-2xl backdrop-blur-lg bg-[var(--surface-strong)]`}
        >
            <div className="shrink-0 p-2 rounded-xl bg-slate-900/70 dark:bg-slate-800/70">
                {icons[type]}
            </div>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 flex-1 leading-relaxed">
                {message}
            </p>
            <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                aria-label="Fechar notificação"
            >
                <X size={16} />
            </motion.button>
        </motion.div>
    );
};

export default Toast;

