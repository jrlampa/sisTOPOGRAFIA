import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { MtTopology } from "../types";

const MtTopologyPanel = React.lazy(() =>
  lazyWithRetry(() => import("./MtTopologyPanel")),
);

export interface SidebarMtEditorSectionProps {
  mtTopology: MtTopology;
  onMtTopologyChange: (next: MtTopology) => void;
}

export function SidebarMtEditorSection({
  mtTopology,
  onMtTopologyChange,
}: SidebarMtEditorSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-orange-800/25 bg-orange-50 p-4 text-xs font-semibold uppercase tracking-wide text-orange-900 shadow-[4px_4px_0_rgba(124,45,18,0.16)]">
            <Loader2 size={14} className="animate-spin" />
            Carregando painel MT…
          </div>
        }
      >
        <MtTopologyPanel
          mtTopology={mtTopology}
          onTopologyChange={onMtTopologyChange}
        />
      </Suspense>
    </div>
  );
}
