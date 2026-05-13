import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'info',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: <AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />,
      button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
    },
    warning: {
      icon: <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />,
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    info: {
      icon: <AlertTriangle className="text-blue-600 dark:text-blue-400" size={24} />,
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
  };

  const v = variants[variant];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('p-3 rounded-2xl', v.bg)}>
              {v.icon}
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2 uppercase tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {description}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row-reverse gap-3 mt-4">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-6 py-2.5 rounded-xl text-white text-sm font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2',
              v.button
            )}
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
