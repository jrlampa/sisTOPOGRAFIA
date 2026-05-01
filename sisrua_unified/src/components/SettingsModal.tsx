import React, { useState, useRef, useEffect } from "react";
import { X, Cpu, Settings, FolderTree, Layout, FileDown } from "lucide-react";
import {
  AppSettings,
  LayerConfig,
  ProjectionType,
  SelectionMode,
  GeoLocation,
  MapProvider,
  SimplificationLevel,
  ProjectMetadata,
  ContourRenderMode,
  BtProjectType,
  BtEditorMode,
  BtQtPontoCalculationMethod,
  BtTransformerCalculationMode,
} from "../types";
import { SettingsModalProjectTab } from "./settings/SettingsModalProjectTab";
import { SettingsModalGeneralTab } from "./settings/SettingsModalGeneralTab";
import { SettingsModalExportFooter } from "./settings/SettingsModalExportFooter";
import { getSettingsModalText } from "../i18n/settingsModalText";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { motion, AnimatePresence } from "framer-motion";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;

  // Selection Props
  selectionMode?: SelectionMode;
  onSelectionModeChange?: (mode: SelectionMode) => void;
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  polygon?: GeoLocation[];
  onClearPolygon?: () => void;

  // Export Props
  hasData?: boolean;
  isDownloading?: boolean;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;

  // Persistence Props
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  selectionMode: _selectionMode,
  onSelectionModeChange: _onSelectionModeChange,
  radius: _radius,
  onRadiusChange: _onRadiusChange,
  polygon: _polygon,
  onClearPolygon: _onClearPolygon,
  hasData,
  isDownloading,
  onExportDxf,
  onExportGeoJSON,
  onSaveProject,
  onLoadProject,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "project">("general");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const text = getSettingsModalText(settings.locale);
  const modalRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setSimplification = (level: SimplificationLevel) =>
    onUpdateSettings({ ...settings, simplificationLevel: level });
  const toggleTheme = () =>
    onUpdateSettings({
      ...settings,
      theme: settings.theme === "dark" ? "light" : "dark",
    });

  const setProjection = (proj: ProjectionType) =>
    onUpdateSettings({ ...settings, projection: proj });
  const setMapProvider = (provider: MapProvider) =>
    onUpdateSettings({ ...settings, mapProvider: provider });
  const setContourRenderMode = (mode: ContourRenderMode) =>
    onUpdateSettings({ ...settings, contourRenderMode: mode });
  const setBtProjectType = (projectType: BtProjectType) =>
    onUpdateSettings({ ...settings, projectType });
  const setBtEditorMode = (btEditorMode: BtEditorMode) =>
    onUpdateSettings({ ...settings, btEditorMode });
  const setBtTransformerCalculationMode = (
    btTransformerCalculationMode: BtTransformerCalculationMode,
  ) => onUpdateSettings({ ...settings, btTransformerCalculationMode });
  const setBtQtPontoCalculationMethod = (
    btQtPontoCalculationMethod: BtQtPontoCalculationMethod,
  ) => onUpdateSettings({ ...settings, btQtPontoCalculationMethod });
  const setBtCqtPowerFactor = (btCqtPowerFactor: number) =>
    onUpdateSettings({ ...settings, btCqtPowerFactor });
  const setClandestinoAreaM2 = (clandestinoAreaM2: number) =>
    onUpdateSettings({ ...settings, clandestinoAreaM2 });

  const toggleLayer = (key: keyof LayerConfig) => {
    onUpdateSettings({
      ...settings,
      layers: {
        ...settings.layers,
        [key]: !settings.layers[key],
      },
    });
  };

  const updateMetadata = (key: keyof ProjectMetadata, value: string) => {
    onUpdateSettings({
      ...settings,
      projectMetadata: {
        ...settings.projectMetadata,
        [key]: value,
      },
    });
  };

  const TABS = [
    { id: "general", label: text.generalTabLabel, icon: Layout },
    { id: "project", label: text.projectTabLabel, icon: FolderTree },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="glass-card flex h-[600px] w-full max-w-4xl flex-row overflow-hidden border border-slate-200/70 shadow-2xl animate-in fade-in zoom-in duration-200 dark:border-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div className="flex w-64 flex-col border-r border-slate-200/70 bg-slate-50/50 dark:border-white/5 dark:bg-slate-900/50">
          <div className="p-6">
            <h2
              id="settings-modal-title"
              className="text-enterprise-blue flex items-center gap-2 text-xl font-black uppercase tracking-tight"
            >
              <Settings size={22} className="text-enterprise-blue-light" />
              {text.panelTitle}
            </h2>
          </div>

          <div className="flex flex-1 flex-col gap-1 p-3">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4">
            <button
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
            >
              {text.closePanel}
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
          <div className="flex flex-1 flex-col overflow-y-auto p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                {activeTab === "project" ? (
                  <SettingsModalProjectTab
                    settings={settings}
                    fileInputRef={fileInputRef}
                    onSaveProject={onSaveProject}
                    onLoadProject={onLoadProject}
                    setBtProjectType={setBtProjectType}
                    setBtEditorMode={setBtEditorMode}
                    setBtTransformerCalculationMode={
                      setBtTransformerCalculationMode
                    }
                    setBtQtPontoCalculationMethod={
                      setBtQtPontoCalculationMethod
                    }
                    setBtCqtPowerFactor={setBtCqtPowerFactor}
                    setClandestinoAreaM2={setClandestinoAreaM2}
                    updateMetadata={updateMetadata}
                  />
                ) : (
                  <SettingsModalGeneralTab
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                    setSimplification={setSimplification}
                    toggleTheme={toggleTheme}
                    setProjection={setProjection}
                    setMapProvider={setMapProvider}
                    setContourRenderMode={setContourRenderMode}
                    toggleLayer={toggleLayer}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-6 dark:border-white/5 dark:bg-slate-800/30">
            <SettingsModalExportFooter
              locale={settings.locale}
              hasData={hasData}
              isDownloading={isDownloading}
              exportMemorialPdfWithDxf={settings.exportMemorialPdfWithDxf}
              onToggleExportMemorialPdfWithDxf={(enabled) =>
                onUpdateSettings({
                  ...settings,
                  exportMemorialPdfWithDxf: enabled,
                })
              }
              onExportDxf={onExportDxf}
              onExportGeoJSON={onExportGeoJSON}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
