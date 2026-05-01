import React, { useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { trackErrorFriction } from "../utils/analytics";

export type ToastType = "success" | "error" | "info" | "warning" | "alert";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  stackOffset?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 4000,
  action,
  stackOffset = 0,
}) => {
  useEffect(() => {
    // UX-20: Track error friction
    if (type === "error") {
      trackErrorFriction(message, !!action);
    }

    // If there is an action (like Retry), we might want to keep the toast open longer
    const adjustedDuration = action ? duration * 2 : duration;

    const timer = setTimeout(() => {
      onClose();
    }, adjustedDuration);

    return () => clearTimeout(timer);
  }, [onClose, duration, action, type, message]);

  const icons = {
    success: (
      <CheckCircle2
        className="text-enterprise-blue dark:text-emerald-300"
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
    success: "border-enterprise-blue/45",
    error: "border-rose-500/45",
    info: "border-sky-500/45",
    warning: "border-amber-500/45",
    alert: "border-orange-500/45",
  };

  const bgColors = {
    success:
      "from-blue-50/90 to-white/95 dark:from-emerald-900/35 dark:to-slate-900/95",
    error:
      "from-rose-100/90 to-white/95 dark:from-rose-900/35 dark:to-slate-900/95",
    info: "from-sky-100/90 to-white/95 dark:from-sky-900/35 dark:to-slate-900/95",
    warning:
      "from-amber-100/90 to-white/95 dark:from-amber-900/35 dark:to-slate-900/95",
    alert:
      "from-orange-100/90 to-white/95 dark:from-orange-900/35 dark:to-slate-900/95",
  };

  const iconContainers = {
    success: "bg-blue-100/80 dark:bg-emerald-900/45",
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
      style={{ top: `${16 + stackOffset * 80}px` }}
      className={`fixed right-4 z-[1000] flex items-center gap-3 p-4 rounded-2xl border bg-gradient-to-br ${borderColors[type]} ${bgColors[type]} max-w-md w-[calc(100vw-2rem)] md:w-full transition-colors shadow-2xl backdrop-blur-lg`}
    >
      <div className={`shrink-0 p-2 rounded-xl ${iconContainers[type]}`}>
        {icons[type]}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 leading-5">
          {message}
        </p>
        {action && (
          <button
            onClick={() => {
              // UX-20: Track retry click
              trackErrorFriction(message, true, true);
              action.onClick();
              onClose();
            }}
            className="mt-1 flex w-fit items-center gap-1.5 rounded-lg bg-slate-900/10 px-2.5 py-1.5 text-xs font-black uppercase tracking-widest text-slate-900 hover:bg-slate-900/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-all active:scale-95"
          >
            <RefreshCw size={10} />
            {action.label}
          </button>
        )}
      </div>
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
