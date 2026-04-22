import React, { useState, useRef, useEffect } from "react";
import { X, Cpu } from "lucide-react";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="glass-card w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-slate-200/70 dark:border-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-200/70 dark:border-white/10">
          <h2
            id="settings-modal-title"
            className="text-enterprise-blue flex items-center gap-2 text-xl font-bold"
          >
            <Cpu size={24} className="text-enterprise-blue-light" />
            {text.panelTitle}
          </h2>
          <button
            onClick={onClose}
            title={text.closePanel}
            aria-label={text.closePanel}
            className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/70 dark:border-white/10">
          <button
            id="settings-tab-general"
            onClick={() => setActiveTab("general")}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              activeTab === "general"
                ? "text-enterprise-blue border-enterprise-blue border-b-2 glass-panel-hover"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/20 dark:hover:bg-slate-800/40"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
            title={text.generalTabTitle}
          >
            {text.generalTabLabel}
          </button>
          <button
            id="settings-tab-project"
            onClick={() => setActiveTab("project")}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              activeTab === "project"
                ? "text-enterprise-blue border-enterprise-blue border-b-2 glass-panel-hover"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/20 dark:hover:bg-slate-800/40"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
            title={text.projectTabTitle}
          >
            {text.projectTabLabel}
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === "project" ? (
            <SettingsModalProjectTab
              settings={settings}
              fileInputRef={fileInputRef}
              onSaveProject={onSaveProject}
              onLoadProject={onLoadProject}
              setBtProjectType={setBtProjectType}
              setBtEditorMode={setBtEditorMode}
              setBtTransformerCalculationMode={setBtTransformerCalculationMode}
              setBtQtPontoCalculationMethod={setBtQtPontoCalculationMethod}
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
        </div>

        <SettingsModalExportFooter
          hasData={hasData}
          isDownloading={isDownloading}
          onExportDxf={onExportDxf}
          onExportGeoJSON={onExportGeoJSON}
        />
      </div>
    </div>
  );
};

export default SettingsModal;
