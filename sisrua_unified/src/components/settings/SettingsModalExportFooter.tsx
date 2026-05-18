import React from 'react';
import { Download, FileJson, Loader2 } from 'lucide-react';
import { getSettingsModalText } from '../../i18n/settingsModalText';
import type { AppLocale } from '../../types';

type SettingsModalExportFooterProps = {
  locale: AppLocale;
  hasData?: boolean;
  isDownloading?: boolean;
  exportMemorialPdfWithDxf: boolean;
  onToggleExportMemorialPdfWithDxf: (enabled: boolean) => void;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;
};

export function SettingsModalExportFooter({
  locale,
  hasData,
  isDownloading,
  exportMemorialPdfWithDxf,
  onToggleExportMemorialPdfWithDxf,
  onExportDxf,
  onExportGeoJSON,
}: SettingsModalExportFooterProps) {
  const text = getSettingsModalText(locale);

  return (
    <div className="p-6 border-t border-white/20 glass-panel rounded-b-xl space-y-3">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
        {text.exportResultsTitle}
      </h3>

      <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-3 bg-white/40 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-100">
              {text.exportMemorialPdfLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {text.exportMemorialPdfHint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleExportMemorialPdfWithDxf(!exportMemorialPdfWithDxf)}
            disabled={isDownloading}
            title={text.exportMemorialPdfLabel}
            aria-label={text.exportMemorialPdfLabel}
            className={`w-12 h-6 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
              exportMemorialPdfWithDxf ? 'bg-emerald-500' : 'bg-slate-400'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                exportMemorialPdfWithDxf ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
      </div>

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
