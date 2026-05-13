import { AlertCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ErrorAlertProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  title,
  description,
  action,
  dismissible = true,
  onDismiss,
  className = '',
}: ErrorAlertProps) {
  return (
    <div className={cn(
      'rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/10 dark:border-rose-900/30 p-5 animate-in fade-in slide-in-from-top-2 duration-300',
      className
    )}>
      <div className="flex gap-4">
        <div className="p-2 h-fit rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
          <AlertCircle size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-rose-900 dark:text-rose-300 leading-tight">{title}</h3>
          {description && (
            <p className="text-sm text-rose-800/80 dark:text-rose-400/80 mt-1.5 leading-relaxed font-medium">
              {description}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.loading}
              className="mt-4 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            >
              {action.loading ? 'Processando...' : action.label}
            </button>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 h-fit rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-400 dark:text-rose-600 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
