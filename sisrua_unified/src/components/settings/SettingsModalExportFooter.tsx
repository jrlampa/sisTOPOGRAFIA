import React from "react";
import { Download, FileJson, Loader2 } from "lucide-react";
import { getSettingsModalText } from "../../i18n/settingsModalText";
import type { AppLocale } from "../../types";

type SettingsModalExportFooterProps = {
  locale: AppLocale;
  hasData?: boolean;
  isDownloading?: boolean;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;
};

export function SettingsModalExportFooter({
  locale,
  hasData,
  isDownloading,
  onExportDxf,
  onExportGeoJSON,
}: SettingsModalExportFooterProps) {
  const text = getSettingsModalText(locale);

  return (
    <div className="p-6 border-t border-white/20 glass-panel rounded-b-xl space-y-3">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
        {text.exportResultsTitle}
      </h3>

      {!hasData ? (
        <div className="text-center p-3 glass-panel rounded-lg text-sm text-slate-600 border border-white/30 border-dashed">
          {text.exportDisabledMessage}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onExportGeoJSON}
            disabled={!onExportGeoJSON || isDownloading}
            className="py-3 glass-panel-hover text-slate-700 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-xl"
          >
            <FileJson size={18} />
            {text.exportGeoJson}
          </button>
          <button
            onClick={onExportDxf}
            disabled={!onExportDxf || isDownloading}
            className="py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-xl"
          >
            {isDownloading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            {text.exportDxf}
          </button>
        </div>
      )}
    </div>
  );
}