type Props = {
  visible: boolean;
  label: string;
};

export function DxfProgressBadge({ visible, label }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
      {label}
    </div>
  );
}
