import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { MtTopology, MtEditorMode } from "../types";

const MtTopologyPanel = React.lazy(() =>
  lazyWithRetry(() => import("./MtTopologyPanel")),
);
import { Plus, Link as LinkIcon, MousePointer2 } from "lucide-react";
import type { AppLocale } from "../types";
import { getSidebarMtEditorText } from "../i18n/sidebarMtEditorText";

export interface SidebarMtEditorSectionProps {
  locale: AppLocale;
  mtTopology: MtTopology;
  onMtTopologyChange: (next: MtTopology) => void;
  mtEditorMode: MtEditorMode;
  onMtEditorModeChange: (mode: MtEditorMode) => void;
  hasBtPoles?: boolean;
}

export function SidebarMtEditorSection({
  locale,
  mtTopology,
  onMtTopologyChange,
  mtEditorMode,
  onMtEditorModeChange,
  hasBtPoles = false,
}: SidebarMtEditorSectionProps) {
  const t = getSidebarMtEditorText(locale);

  return (
    <div className="flex flex-col gap-3">
      {/* MT Editor Mode Selector */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-orange-200 bg-orange-50/50 p-1 dark:border-orange-900/30 dark:bg-orange-950/20">
        <button
          onClick={() => onMtEditorModeChange("none")}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
            mtEditorMode === "none"
              ? "bg-white text-orange-700 shadow-sm dark:bg-orange-900/40 dark:text-orange-200"
              : "text-orange-600/70 hover:bg-white/50 dark:text-orange-400/60"
          }`}
        >
          <MousePointer2 size={12} />
          {t.btnNav}
        </button>
        <button
          onClick={() => onMtEditorModeChange("mt-add-pole")}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
            mtEditorMode === "mt-add-pole"
              ? "bg-orange-600 text-white shadow-md dark:bg-orange-600"
              : "text-orange-600/70 hover:bg-white/50 dark:text-orange-400/60"
          }`}
        >
          <Plus size={12} />
          {t.btnPole}
        </button>
        <button
          onClick={() => onMtEditorModeChange("mt-add-edge")}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
            mtEditorMode === "mt-add-edge"
              ? "bg-orange-600 text-white shadow-md dark:bg-orange-600"
              : "text-orange-600/70 hover:bg-white/50 dark:text-orange-400/60"
          }`}
        >
          <LinkIcon size={12} />
          {t.btnEdge}
        </button>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-orange-800/25 bg-orange-50 p-4 text-xs font-semibold uppercase tracking-wide text-orange-900 shadow-[4px_4px_0_rgba(124,45,18,0.16)]">
            <Loader2 size={14} className="animate-spin" />
            {t.loadingMtPanel}
          </div>
        }
      >
        <MtTopologyPanel
          mtTopology={mtTopology}
          onTopologyChange={onMtTopologyChange}
          mtEditorMode={mtEditorMode}
          hasBtPoles={hasBtPoles}
        />
      </Suspense>
    </div>
  );
}
