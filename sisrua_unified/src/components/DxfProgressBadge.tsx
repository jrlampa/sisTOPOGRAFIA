type Props = {
  visible: boolean;
  label: string;
};

export function DxfProgressBadge({ visible, label }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-white/90 dark:bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-lg backdrop-blur-md"
    >
      {label}
    </div>
  );
}
