import { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  iconColor?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconColor = 'text-slate-300 dark:text-slate-600',
  className = '',
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800', className)}>
      <div className={cn('p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm mb-6', iconColor)}>
        <Icon size={40} strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] mb-8 leading-relaxed">{description}</p>
      {action && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          {action}
        </div>
      )}
    </div>
  );
}
