import React from "react";
import { Circle, Sigma, HardDrive, Hash } from "lucide-react";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface BtTopologyPanelStatsProps {
  locale: AppLocale;
  poles: number;
  transformers: number;
  edges: number;
  totalLengthMeters: number;
  transformerDemandKva: number;
}

const BtTopologyPanelStats: React.FC<BtTopologyPanelStatsProps> = ({
  locale,
  poles,
  transformers,
  edges,
  totalLengthMeters,
  transformerDemandKva,
}) => {
  const t = getBtTopologyPanelText(locale).stats;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Hash size={10} className="text-blue-500" />
          {t.componentsTitle}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-0.5"><Circle size={8} className="fill-blue-500 text-blue-500" /> {poles} {t.poles}</span>
          <span className="flex items-center gap-0.5"><Circle size={8} className="fill-fuchsia-500 text-fuchsia-500" /> {transformers} {t.transformers}</span>
          <span className="flex items-center gap-0.5"><Circle size={8} className="fill-emerald-500 text-emerald-500" /> {edges} {t.edges}</span>
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Sigma size={10} className="text-emerald-500" />
          {t.metricsTitle}
        </div>
        <div className="mt-1 flex flex-col gap-0.5 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1"><HardDrive size={10} /> {totalLengthMeters.toFixed(1)} {t.networkLengthMeters}</span>
          <span className="flex items-center gap-1 font-bold text-slate-900"><Hash size={10} /> {transformerDemandKva.toFixed(2)} kVA</span>
        </div>
      </div>
    </div>
  );
};

export default BtTopologyPanelStats;
