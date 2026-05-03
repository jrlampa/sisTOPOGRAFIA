import React, { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Keyboard, Loader2, PanelLeftOpen } from "lucide-react";
import { BtModalStack } from "./BtModalStack";
import { EmptyStateMapOverlay } from "./EmptyStateMapOverlay";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { AppLocale } from "../types";
import { getMainMapWorkspaceText } from "../i18n/mainMapWorkspaceText";

const MapSelector = React.lazy(() =>
  lazyWithRetry(() => import("./MapSelector")),
);
const FloatingLayerPanel = React.lazy(() =>
  lazyWithRetry(() => import("./FloatingLayerPanel")),
);
const ElevationProfile = React.lazy(() =>
  lazyWithRetry(() => import("./ElevationProfile")),
);

const MapSuspenseFallback = ({ label }: { label: string }) => (
  <div className="absolute inset-0 flex items-center justify-center rounded-[1.75rem] border border-sky-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(148,163,184,0.18)] dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  </div>
);

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-[0_12px_28px_rgba(148,163,184,0.16)] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:shadow-none">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

type Props = {
  locale: AppLocale;
  mapSelectorProps: any;
  floatingLayerPanelProps: any;
  elevationProfileData: any[];
  onCloseElevationProfile: () => void;
  isDark: boolean;
  isSidebarCollapsed?: boolean;
  onRestoreSidebar?: () => void;
  btModalStackProps: React.ComponentProps<typeof BtModalStack>;
  hasAreaSelection: boolean;
  onStartSearch: () => void;
  onMapClickAction: () => void;
  isXRayMode?: boolean;
};

export function MainMapWorkspace({
  locale,
  mapSelectorProps,
  floatingLayerPanelProps,
  elevationProfileData,
  onCloseElevationProfile,
  isDark,
  isSidebarCollapsed = false,
  onRestoreSidebar = () => {},
  btModalStackProps,
  hasAreaSelection,
  onStartSearch,
  onMapClickAction,
  isXRayMode = false,
}: Props) {
  const t = getMainMapWorkspaceText(locale);

  return (
    <div className="relative z-10 flex-1 min-h-[44vh] p-3 md:p-4 xl:min-h-0">
      <Suspense fallback={<MapSuspenseFallback label={t.mapLoading} />}>
        <div className="relative h-full rounded-[1.75rem] border border-sky-200 bg-white p-2 shadow-[0_18px_42px_rgba(148,163,184,0.2)] dark:border-white/10 dark:bg-slate-950 dark:shadow-none">
          <MapSelector
            {...mapSelectorProps}
            dgGhostMode={mapSelectorProps.dgGhostMode}
            locale={locale}
            keyboardPanEnabled={isSidebarCollapsed}
            isXRayMode={isXRayMode}
          />

          {!hasAreaSelection && (
            <EmptyStateMapOverlay
              locale={locale}
              onStartSearch={() => {
                onRestoreSidebar();
                onStartSearch();
              }}
              onMapClickAction={() => {
                onRestoreSidebar();
                onMapClickAction();
              }}
            />
          )}

          {isSidebarCollapsed && (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[460] flex flex-col gap-2">
              <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-cyan-200 bg-white/95 px-3 py-2 shadow-[0_12px_24px_rgba(14,116,144,0.14)] backdrop-blur-sm dark:border-cyan-300/20 dark:bg-slate-900/95 dark:shadow-none">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-900 dark:text-cyan-100">
                  <Keyboard size={14} />
                  {t.keyboardMouseFirst}
                </span>
                <button
                  type="button"
                  onClick={onRestoreSidebar}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-black uppercase tracking-wide text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-300/20 dark:bg-cyan-950/30 dark:text-cyan-100 dark:hover:bg-cyan-900/50"
                >
                  <PanelLeftOpen size={12} />
                  {t.openSidebar}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 shadow-[0_12px_24px_rgba(148,163,184,0.14)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-none">
                <div className="mb-1 text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {t.navHintsTitle}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{t.navHintMove}</span>
                  <span>{t.navHintArrows}</span>
                  <span>{t.navHintScroll}</span>
                  <span>{t.navHintMiddleBtn}</span>
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
              <InlineSuspenseFallback label={t.elevationProfileLoading} />
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
