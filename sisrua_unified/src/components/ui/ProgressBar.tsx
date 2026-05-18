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
    blue: 'fill-blue-500',
    emerald: 'fill-emerald-500',
    amber: 'fill-amber-500',
    rose: 'fill-rose-500',
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
        <svg
          className="w-full h-full"
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            x="0"
            y="0"
            width={clampedValue}
            height="4"
            rx="2"
            className={cn('transition-all duration-500 ease-out', colorMap[variant])}
          />
        </svg>
      </div>
      {showLabel && (
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Status
          </span>
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
