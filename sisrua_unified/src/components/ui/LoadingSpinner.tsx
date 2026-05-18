import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  label,
  fullScreen = false,
  overlay = false,
  className = '',
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: { icon: 16, container: 'h-16' },
    md: { icon: 24, container: 'h-24' },
    lg: { icon: 32, container: 'h-32' },
  };

  const sizes = sizeMap[size];

  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-2', sizes.container, className)}>
      <Loader2 size={sizes.icon} className="text-blue-500 dark:text-blue-400 animate-spin" />
      {label && <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        {overlay && <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm pointer-events-auto" />}
        <div className="relative pointer-events-auto bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}
