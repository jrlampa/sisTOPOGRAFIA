import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Car,
  Globe,
  Grid3X3,
  LampFloor,
  Layers,
  Map as MapIcon,
  Moon,
  Mountain,
  PencilRuler,
  Satellite,
  Sun,
  Type,
  Zap,
} from "lucide-react";
import ConstantsCatalogOps from "../ConstantsCatalogOps";
import {
  AppSettings,
  AppLocale,
  ContourRenderMode,
  LayerConfig,
  MapProvider,
  ProjectionType,
  SimplificationLevel,
} from "../../types";
import { getAppLocaleLabel, SUPPORTED_APP_LOCALES } from "../../i18n/appLocale";
import { getSettingsModalText } from "../../i18n/settingsModalText";

type SettingsModalGeneralTabProps = {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  setSimplification: (level: SimplificationLevel) => void;
  toggleTheme: () => void;
  setProjection: (proj: ProjectionType) => void;
  setMapProvider: (provider: MapProvider) => void;
  setContourRenderMode: (mode: ContourRenderMode) => void;
  toggleLayer: (key: keyof LayerConfig) => void;
};

type LayerToggleProps = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
  colorClass: string;
};

function LayerToggle({
  label,
  icon: Icon,
  active,
  onClick,
  colorClass,
}: LayerToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all glass-panel-hover ${
        active
          ? "border-white/40 shadow-md"
          : "border-white/20 text-slate-500 hover:border-white/30"
      } ${active ? "text-enterprise-blue" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
    >
      <div className={`p-2 rounded-md ${active ? colorClass : "bg-white/20"}`}>
        <Icon size={18} className={active ? "text-white" : "text-slate-500"} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <div
        className={`ml-auto h-3 w-3 rounded-full ${active ? "bg-enterprise-blue shadow-md" : "bg-slate-400"}`}
      />
    </button>
  );
}

export function SettingsModalGeneralTab({
  settings,
  onUpdateSettings,
  setSimplification,
  toggleTheme,
  setProjection,
  setMapProvider,
  setContourRenderMode,
  toggleLayer,
}: SettingsModalGeneralTabProps) {
  const text = getSettingsModalText(settings.locale);

  return (
    <div
      role="tabpanel"
      id="settings-panel-general"
      aria-labelledby="settings-tab-general"
    >
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          {text.interfaceMapTitle}
        </h3>

        <div className="rounded-lg border border-cyan-200 bg-cyan-50/80 p-3 text-xs text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-950/30 dark:text-cyan-100">
          <p className="font-semibold">{text.canonicalStyleTitle}</p>
          <p className="mt-1 opacity-90">{text.canonicalStyleDescription}</p>
        </div>

        <div className="flex items-center justify-between glass-panel p-3 rounded-lg">
          <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
            {settings.theme === "dark" ? (
              <Moon size={16} className="text-purple-500" />
            ) : (
              <Sun size={16} className="text-yellow-500" />
            )}
            {settings.theme === "dark"
              ? text.themeLabelDark
              : text.themeLabelLight}
          </span>
          <button
            onClick={toggleTheme}
            title={text.toggleTheme}
            aria-label={text.toggleTheme}
            className={`w-12 h-6 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${settings.theme === "dark" ? "bg-slate-400" : "bg-yellow-400"}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${settings.theme === "dark" ? "translate-x-6" : ""}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMapProvider("vector")}
            className={`btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
              settings.mapProvider === "vector"
                ? "border-blue-400 text-blue-600 shadow-md bg-blue-50"
                : "border-white/30 text-slate-600 dark:text-slate-300"
            }`}
          >
            <MapIcon size={16} />
            {text.mapVector}
          </button>
          <button
            onClick={() => setMapProvider("satellite")}
            className={`btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
              settings.mapProvider === "satellite"
                ? "border-blue-400 text-blue-600 shadow-md bg-blue-50"
                : "border-white/30 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Satellite size={16} />
            {text.mapSatellite}
          </button>
        </div>

        <div className="glass-panel rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Globe size={16} className="text-cyan-600 dark:text-cyan-300" />
            {text.interfaceLanguage}
          </div>
          <select
            value={settings.locale}
            onChange={(event) =>
              onUpdateSettings({
                ...settings,
                locale: event.target.value as AppLocale,
              })
            }
            aria-label="Selecionar idioma da interface"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {SUPPORTED_APP_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {getAppLocaleLabel(locale, settings.locale)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {text.interfaceLanguageHint}
          </p>
        </div>
      </div>

      <div className="h-px bg-white/20" />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {text.dxfLayersTitle}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <LayerToggle
            label={text.layerBuildings}
            icon={Building2}
            active={settings.layers.buildings}
            onClick={() => toggleLayer("buildings")}
            colorClass="bg-yellow-500/20 text-yellow-500"
          />

          <div
            className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.dimensions ? "bg-slate-800 border-blue-500/50" : "bg-slate-900 border-slate-800"}`}
          >
            <button
              onClick={() => toggleLayer("dimensions")}
              className="flex items-center gap-2 text-xs w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
            >
              <PencilRuler
                size={14}
                className={
                  settings.layers.dimensions
                    ? "text-blue-400"
                    : "text-slate-600"
                }
              />
              <span
                className={
                  settings.layers.dimensions
                    ? "text-blue-200"
                    : "text-slate-500"
                }
              >
                {text.layerDimensions}
              </span>
              <div
                className={`ml-auto w-2 h-2 rounded-full ${settings.layers.dimensions ? "bg-blue-500" : "bg-slate-700"}`}
              />
            </button>
          </div>

          <LayerToggle
            label={text.layerRoads}
            icon={Car}
            active={settings.layers.roads}
            onClick={() => toggleLayer("roads")}
            colorClass="bg-red-500/20 text-red-500"
          />

          {settings.layers.roads && (
            <div
              className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.curbs ? "bg-slate-800 border-red-500/50" : "bg-slate-900 border-slate-800"}`}
            >
              <button
                onClick={() => toggleLayer("curbs")}
                className="flex items-center gap-2 text-xs w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
              >
                <ArrowLeftRight
                  size={14}
                  className={
                    settings.layers.curbs ? "text-red-400" : "text-slate-600"
                  }
                />
                <span
                  className={
                    settings.layers.curbs ? "text-red-200" : "text-slate-500"
                  }
                >
                  {text.layerCurbs}
                </span>
                <div
                  className={`ml-auto w-2 h-2 rounded-full ${settings.layers.curbs ? "bg-red-500" : "bg-slate-700"}`}
                />
              </button>
            </div>
          )}

          <LayerToggle
            label={text.layerTerrain}
            icon={Mountain}
            active={settings.layers.terrain}
            onClick={() => toggleLayer("terrain")}
            colorClass="bg-purple-500/20 text-purple-500"
          />
          <LayerToggle
            label={text.layerContours}
            icon={Activity}
            active={settings.layers.contours}
            onClick={() => toggleLayer("contours")}
            colorClass="bg-pink-500/20 text-pink-500"
          />

          {settings.layers.terrain && (
            <div
              className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.slopeAnalysis ? "bg-slate-800 border-orange-500/50" : "bg-slate-900 border-slate-800"}`}
            >
              <button
                onClick={() => toggleLayer("slopeAnalysis")}
                className="flex items-center gap-2 text-xs w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
              >
                <AlertTriangle
                  size={14}
                  className={
                    settings.layers.slopeAnalysis
                      ? "text-orange-400"
                      : "text-slate-600"
                  }
                />
                <span
                  className={
                    settings.layers.slopeAnalysis
                      ? "text-orange-200"
                      : "text-slate-500"
                  }
                >
                  {text.slopeAnalysisLabel}
                </span>
                <div
                  className={`ml-auto w-2 h-2 rounded-full ${settings.layers.slopeAnalysis ? "bg-orange-500" : "bg-slate-700"}`}
                />
              </button>
            </div>
          )}

          {settings.layers.contours && (
            <div className="ml-12 p-3 bg-slate-950/50 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>{text.contourInterval}</span>
                <span className="text-white font-mono">
                  {settings.contourInterval}m
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.contourInterval || 5}
                title="Intervalo das curvas de nível"
                onChange={(event) =>
                  onUpdateSettings({
                    ...settings,
                    contourInterval: parseInt(event.target.value),
                  })
                }
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />

              <div className="mt-3">
                <div className="text-xs text-slate-400 mb-2">
                  {text.contourType}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setContourRenderMode("spline")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
                      settings.contourRenderMode === "spline"
                        ? "bg-pink-600 border-pink-500 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                  >
                    {text.contourSpline}
                  </button>
                  <button
                    onClick={() => setContourRenderMode("polyline")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
                      settings.contourRenderMode === "polyline"
                        ? "bg-pink-600 border-pink-500 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                  >
                    {text.contourPolyline}
                  </button>
                </div>
              </div>
            </div>
          )}

          <LayerToggle
            label={text.layerFurniture}
            icon={LampFloor}
            active={settings.layers.furniture}
            onClick={() => toggleLayer("furniture")}
            colorClass="bg-orange-500/20 text-orange-500"
          />
          <LayerToggle
            label={text.layerLabels}
            icon={Type}
            active={settings.layers.labels}
            onClick={() => toggleLayer("labels")}
            colorClass="bg-white/20 text-white"
          />

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${settings.layers.grid ? "bg-slate-800 border-white/30 text-white" : "bg-slate-900 border-slate-700 text-slate-500"}`}
          >
            <div className="p-2 bg-slate-800 rounded-md">
              <Grid3X3
                size={18}
                className={
                  settings.layers.grid ? "text-white" : "text-slate-500"
                }
              />
            </div>
            <button
              onClick={() => toggleLayer("grid")}
              className="flex-1 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
            >
              {text.layerGrid}
            </button>
            <div
              className={`w-3 h-3 rounded-full ${settings.layers.grid ? "bg-blue-500" : "bg-slate-700"}`}
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {text.systemTitle}
        </h3>

        <div className="bg-slate-800/30 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-slate-400 uppercase">
              {text.geometryProcessing}
            </span>
          </div>

          <div className="flex gap-1 mb-2">
            {(["off", "low", "medium", "high"] as SimplificationLevel[]).map(
              (level) => (
                <button
                  key={level}
                  onClick={() => setSimplification(level)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
                    settings.simplificationLevel === level
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {
                    (
                      {
                        off: text.simplificationOff,
                        low: text.simplificationLow,
                        medium: text.simplificationMedium,
                        high: text.simplificationHigh,
                      } as Record<string, string>
                    )[level]
                  }
                </button>
              ),
            )}
          </div>

          <button
            onClick={() =>
              onUpdateSettings({
                ...settings,
                orthogonalize: !settings.orthogonalize,
              })
            }
            className={`w-full flex items-center justify-between p-2 rounded border text-xs ${settings.orthogonalize ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-200" : "bg-slate-900 border-slate-700 text-slate-500"}`}
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight
                size={14}
                className={
                  settings.orthogonalize ? "text-indigo-400" : "text-slate-600"
                }
              />
              <span>{text.orthogonalize}</span>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${settings.orthogonalize ? "bg-indigo-500" : "bg-slate-700"}`}
            />
          </button>
        </div>

        <div className="bg-slate-800/30 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase">
              {text.projectionTitle}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setProjection("local")}
              className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
                settings.projection === "local"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {text.projectionLocal}
            </button>
            <button
              onClick={() => setProjection("utm")}
              className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
                settings.projection === "utm"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {text.projectionUtm}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {text.projectionHint}
          </p>
        </div>

        <ConstantsCatalogOps locale={settings.locale} />
      </div>
    </div>
  );
}
