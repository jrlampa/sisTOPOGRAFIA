import React, { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Keyboard, Loader2, PanelLeftOpen } from "lucide-react";
import { BtModalStack } from "./BtModalStack";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const MapSelector = React.lazy(() =>
  lazyWithRetry(() => import("./MapSelector")),
);
const FloatingLayerPanel = React.lazy(() =>
  lazyWithRetry(() => import("./FloatingLayerPanel")),
);
const ElevationProfile = React.lazy(() =>
  lazyWithRetry(() => import("./ElevationProfile")),
);

const MapSuspenseFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center rounded-[1.75rem] border-2 border-amber-700/40 bg-amber-50 text-amber-900 shadow-[8px_8px_0_rgba(124,45,18,0.14)] dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-100 dark:shadow-[8px_8px_0_rgba(251,146,60,0.2)]">
    <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-800/30 bg-white px-5 py-4 text-sm font-semibold dark:border-amber-500/45 dark:bg-zinc-900">
      <Loader2 size={18} className="animate-spin" />
      Carregando mapa 2.5D...
    </div>
  </div>
);

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-800/30 bg-amber-50 p-4 text-xs font-semibold uppercase tracking-wide text-amber-900 shadow-[4px_4px_0_rgba(124,45,18,0.16)] dark:border-amber-500/45 dark:bg-zinc-900 dark:text-amber-100 dark:shadow-[4px_4px_0_rgba(251,146,60,0.22)]">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

type Props = {
  mapSelectorProps: any;
  floatingLayerPanelProps: any;
  elevationProfileData: any[];
  onCloseElevationProfile: () => void;
  isDark: boolean;
  isSidebarCollapsed?: boolean;
  onRestoreSidebar?: () => void;
  btModalStackProps: React.ComponentProps<typeof BtModalStack>;
};

export function MainMapWorkspace({
  mapSelectorProps,
  floatingLayerPanelProps,
  elevationProfileData,
  onCloseElevationProfile,
  isDark,
  isSidebarCollapsed = false,
  onRestoreSidebar = () => {},
  btModalStackProps,
}: Props) {
  return (
    <div className="relative z-10 flex-1 min-h-[44vh] p-3 md:p-4 xl:min-h-0">
      <Suspense fallback={<MapSuspenseFallback />}>
        <div className="relative h-full rounded-[1.75rem] border-2 border-amber-700/40 bg-gradient-to-br from-amber-50/90 via-orange-50/80 to-cyan-50/60 p-2 shadow-[10px_10px_0_rgba(124,45,18,0.14)] dark:border-amber-500/45 dark:from-zinc-950 dark:via-zinc-950 dark:to-cyan-950/20 dark:shadow-[10px_10px_0_rgba(251,146,60,0.2)]">
          <MapSelector
            {...mapSelectorProps}
            keyboardPanEnabled={isSidebarCollapsed}
          />

          {isSidebarCollapsed && (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[460] flex flex-col gap-2">
              <div className="pointer-events-auto flex items-center justify-between rounded-2xl border-2 border-cyan-700/30 bg-cyan-50/95 px-3 py-2 shadow-[4px_4px_0_rgba(14,116,144,0.2)] backdrop-blur-sm dark:border-cyan-300/40 dark:bg-zinc-900/95 dark:shadow-[4px_4px_0_rgba(34,211,238,0.2)]">
                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-900 dark:text-cyan-100">
                  <Keyboard size={14} />
                  Keyboard+Mouse First
                </span>
                <button
                  type="button"
                  onClick={onRestoreSidebar}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/35 bg-cyan-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-900 transition hover:bg-cyan-200 dark:border-cyan-300/35 dark:bg-cyan-950/30 dark:text-cyan-100 dark:hover:bg-cyan-900/50"
                >
                  <PanelLeftOpen size={12} />
                  Abrir painel
                </button>
              </div>

              <div className="rounded-2xl border-2 border-slate-800/20 bg-amber-50/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-900 shadow-[4px_4px_0_rgba(124,45,18,0.18)] backdrop-blur-sm dark:border-amber-300/30 dark:bg-zinc-900/95 dark:text-amber-100 dark:shadow-[4px_4px_0_rgba(251,146,60,0.2)]">
                <div className="mb-1 text-[9px] tracking-[0.2em] text-amber-700 dark:text-amber-300">
                  Hints de navegação
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>W A S D: mover mapa</span>
                  <span>Setas: mover mapa</span>
                  <span>Roda do mouse: zoom</span>
                  <span>Botão do meio: pan livre</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <FloatingLayerPanel {...floatingLayerPanelProps} />
      </Suspense>

      <AnimatePresence>
        {elevationProfileData.length > 0 && (
          <Suspense
            fallback={
              <InlineSuspenseFallback label="Carregando perfil altimetrico" />
            }
          >
            <ElevationProfile
              data={elevationProfileData}
              onClose={onCloseElevationProfile}
              isDark={isDark}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <BtModalStack {...btModalStackProps} />
    </div>
  );
}
