import { cn } from '../../utils/cn';

interface SkeletonLoaderProps {
  count?: number;
  height?: string;
  variant?: 'text' | 'card' | 'avatar' | 'circle';
  className?: string;
}

export function SkeletonLoader({
  count = 3,
  height = 'h-10',
  variant = 'text',
  className = '',
}: SkeletonLoaderProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'avatar':
        return 'rounded-full w-12 h-12';
      case 'circle':
        return 'rounded-full';
      case 'card':
        return 'rounded-xl';
      default:
        return 'rounded-md';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            height,
            getVariantClasses(),
            'bg-slate-200 dark:bg-slate-800 animate-pulse relative overflow-hidden',
            'after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_2s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/20 dark:after:via-slate-700/20 after:to-transparent'
          )}
        />
      ))}
    </div>
  );
}
