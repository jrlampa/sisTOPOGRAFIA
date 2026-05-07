import React, { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { AppSettings, GeoLocation, SelectionMode } from "../types";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const SettingsModal = React.lazy(() =>
  lazyWithRetry(() => import("./SettingsModal")),
);

export type AppSettingsOverlayProps = {
  showSettings: boolean;
  closeSettings: () => void;
  settings: AppSettings;
  updateSettings: (nextSettings: AppSettings) => void;
  selectionMode: SelectionMode;
  handleSelectionModeChange: (mode: SelectionMode) => void;
  radius: number;
  handleRadiusChange: (value: number) => void;
  polygon: GeoLocation[];
  handleClearPolygon: () => void;
  hasData: boolean;
  isDownloading: boolean;
  handleDownloadDxf: () => Promise<void>;
  handleDownloadGeoJSON: () => Promise<void>;
  handleSaveProject: () => void;
  handleLoadProject: (file: File) => void;
};

export function AppSettingsOverlay({
  showSettings,
  closeSettings,
  settings,
  updateSettings,
  selectionMode,
  handleSelectionModeChange,
  radius,
  handleRadiusChange,
  polygon,
  handleClearPolygon,
  hasData,
  isDownloading,
  handleDownloadDxf,
  handleDownloadGeoJSON,
  handleSaveProject,
  handleLoadProject,
}: AppSettingsOverlayProps) {
  return (
    <AnimatePresence>
      {showSettings && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-900/70 p-4 text-xs font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-md"
              >
                <Loader2 size={14} className="animate-spin" />
                Carregando configurações
              </div>
            </div>
          }
        >
          <SettingsModal
            key="settings"
            isOpen={showSettings}
            onClose={closeSettings}
            settings={settings}
            onUpdateSettings={updateSettings}
            selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            polygon={polygon}
            onClearPolygon={handleClearPolygon}
            hasData={hasData}
            isDownloading={isDownloading}
            onExportDxf={handleDownloadDxf}
            onExportGeoJSON={handleDownloadGeoJSON}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        </Suspense>
      )}
    </AnimatePresence>
  );
}
