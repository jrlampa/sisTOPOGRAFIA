import React from 'react';
import { LucideIcon } from 'lucide-react';

/** Reusable nested (sub-)layer toggle with consistent indentation and styling.
 * Pass concrete Tailwind class strings (not dynamic tokens) to avoid purging.
 * @param activeClasses - Tailwind classes applied to the container when active,
 *   e.g. "bg-slate-800 border-blue-500/50"
 * @param iconActiveClass - Icon color class when active, e.g. "text-blue-400"
 * @param labelActiveClass - Label color class when active, e.g. "text-blue-200"
 * @param dotActiveClass - Dot color class when active, e.g. "bg-blue-500"
 */
interface NestedLayerToggleProps {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  activeClasses: string;
  iconActiveClass: string;
  labelActiveClass: string;
  dotActiveClass: string;
}

const NestedLayerToggle: React.FC<NestedLayerToggleProps> = ({
  label,
  icon: Icon,
  active,
  onClick,
  activeClasses,
  iconActiveClass,
  labelActiveClass,
  dotActiveClass,
}) => (
  <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${
    active ? activeClasses : 'bg-slate-900 border-slate-800'
  }`}>
    <button onClick={onClick} className="flex items-center gap-2 text-xs w-full text-left">
      <Icon size={14} className={active ? iconActiveClass : 'text-slate-600'} />
      <span className={active ? labelActiveClass : 'text-slate-500'}>{label}</span>
      <div className={`ml-auto w-2 h-2 rounded-full ${active ? dotActiveClass : 'bg-slate-700'}`} />
    </button>
  </div>
);

export default NestedLayerToggle;
