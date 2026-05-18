import { cn } from '../../utils/cn';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showLabel?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose';
}

export function ProgressBar({
  value = 0,
  label,
  showLabel = true,
  size = 'md',
  className = '',
  variant = 'blue',
}: ProgressBarProps) {
  const heightMap = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
  };

  const clampedValue = Math.min(100, Math.max(0, value));
  const displayLabel = label || `${Math.round(clampedValue)}%`;

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      <div
        className={cn(
          'w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner',
          heightMap[size]
        )}
      >
        <div
          className={cn(
            'h-full bg-gradient-to-r transition-all duration-500 ease-out rounded-full',
            colorMap[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
