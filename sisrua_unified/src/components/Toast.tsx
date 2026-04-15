import React, { useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning" | "alert";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: (
      <CheckCircle2
        className="text-emerald-600 dark:text-emerald-300"
        size={20}
      />
    ),
    error: (
      <AlertCircle className="text-rose-600 dark:text-rose-300" size={20} />
    ),
    info: <Info className="text-sky-600 dark:text-sky-300" size={20} />,
    warning: (
      <AlertTriangle className="text-amber-600 dark:text-amber-300" size={20} />
    ),
    alert: (
      <AlertTriangle
        className="text-orange-600 dark:text-orange-300"
        size={20}
      />
    ),
  };

  const borderColors = {
    success: "border-emerald-500/45",
    error: "border-rose-500/45",
    info: "border-sky-500/45",
    warning: "border-amber-500/45",
    alert: "border-orange-500/45",
  };

  const bgColors = {
    success:
      "from-emerald-100/90 to-white/95 dark:from-emerald-900/35 dark:to-slate-900/95",
    error:
      "from-rose-100/90 to-white/95 dark:from-rose-900/35 dark:to-slate-900/95",
    info: "from-sky-100/90 to-white/95 dark:from-sky-900/35 dark:to-slate-900/95",
    warning:
      "from-amber-100/90 to-white/95 dark:from-amber-900/35 dark:to-slate-900/95",
    alert:
      "from-orange-100/90 to-white/95 dark:from-orange-900/35 dark:to-slate-900/95",
  };

  const iconContainers = {
    success: "bg-emerald-100/80 dark:bg-emerald-900/45",
    error: "bg-rose-100/80 dark:bg-rose-900/45",
    info: "bg-sky-100/80 dark:bg-sky-900/45",
    warning: "bg-amber-100/80 dark:bg-amber-900/45",
    alert: "bg-orange-100/80 dark:bg-orange-900/45",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
      role="alert"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[1000] flex items-center gap-3 p-4 rounded-2xl border bg-gradient-to-br ${borderColors[type]} ${bgColors[type]} max-w-md w-[calc(100vw-2rem)] md:w-full transition-colors shadow-2xl backdrop-blur-lg`}
    >
      <div className={`shrink-0 p-2 rounded-xl ${iconContainers[type]}`}>
        {icons[type]}
      </div>
      <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 flex-1 leading-5">
        {message}
      </p>
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        aria-label="Fechar notificação"
      >
        <X size={16} />
      </motion.button>
    </motion.div>
  );
};

export default Toast;
