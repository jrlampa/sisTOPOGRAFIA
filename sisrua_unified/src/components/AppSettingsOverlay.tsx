import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { AppSettings, GeoLocation, SelectionMode } from '../types';

const SettingsModal = React.lazy(() => import('./SettingsModal'));

type Props = {
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
}: Props) {
  return (
    <AnimatePresence>
      {showSettings && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Carregando configuracoes
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
