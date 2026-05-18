import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const baseClass = 'bg-slate-200 dark:bg-slate-800 animate-pulse transition-colors';

  const variantClasses = {
    text: 'h-3 w-full rounded-md mt-1 mb-1',
    rect: 'h-20 w-full rounded-xl',
    circle: 'h-10 w-10 rounded-full shrink-0',
  };

  return (
    <div className={`${baseClass} ${variantClasses[variant]} ${className}`} aria-hidden="true" />
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-6 p-2">
      <div className="space-y-2">
        <Skeleton variant="text" className="w-1/3 h-2" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton variant="text" className="w-1/4 h-2" />
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xl">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="w-1/3 h-4" />
        <Skeleton variant="circle" className="h-6 w-6" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5"
          >
            <Skeleton variant="text" className="w-1/2 h-2 mb-2" />
            <Skeleton variant="text" className="w-3/4 h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
      <div className="bg-slate-50 dark:bg-zinc-800 p-3 flex gap-4">
        <Skeleton variant="text" className="w-1/4 h-2" />
        <Skeleton variant="text" className="w-1/4 h-2" />
        <Skeleton variant="text" className="w-1/4 h-2" />
      </div>
      <div className="p-3 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton variant="text" className="flex-1 h-3" />
            <Skeleton variant="text" className="flex-1 h-3" />
            <Skeleton variant="text" className="flex-1 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-950 z-[1000] overflow-hidden">
      <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        {/* Simulated grid */}
        <div className="w-full h-full bg-[radial-gradient(circle,_currentColor_1px,_transparent_1px)] bg-[length:40px_40px]" />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Skeleton variant="circle" className="h-16 w-16 bg-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <Skeleton variant="text" className="w-40 h-3 mx-auto" />
          <Skeleton variant="text" className="w-24 h-2 mx-auto opacity-60" />
        </div>
      </div>
    </div>
  );
}
