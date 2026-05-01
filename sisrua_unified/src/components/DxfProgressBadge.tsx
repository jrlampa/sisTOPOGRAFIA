type Props = {
  visible: boolean;
  label: string;
  progress: number;
  status: string | null;
};

export function DxfProgressBadge({ visible, label, progress, status }: Props) {
  if (!visible) {
    return null;
  }

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const displayProgress =
    (status === "queued" || status === "waiting") && clampedProgress === 0
      ? 8
      : clampedProgress;
  const isCompleted = status === "completed" || clampedProgress >= 100;
  const statusTone =
    status === "failed"
      ? "border-rose-500/30"
      : isCompleted
        ? "border-emerald-500/30"
        : "border-cyan-500/30";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-6 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border bg-white/95 px-4 py-3 text-slate-800 shadow-xl backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-100 ${statusTone}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
            Processamento DXF
          </div>
          <div className="mt-0.5 text-sm font-semibold leading-snug">
            {label}
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
          {clampedProgress}%
        </div>
      </div>

      <progress
        className={`mt-3 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200/80 dark:[&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${
          isCompleted
            ? "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
            : "[&::-webkit-progress-value]:bg-cyan-500 [&::-moz-progress-bar]:bg-cyan-500"
        }`}
        max={100}
        value={displayProgress}
      />

      {!isCompleted && status !== "failed" && (
        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Você pode continuar navegando no mapa enquanto o arquivo é gerado.
        </p>
      )}
    </div>
  );
}
