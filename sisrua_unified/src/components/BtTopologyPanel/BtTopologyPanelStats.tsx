import React from "react";
import { Circle, Hash, Activity } from "lucide-react";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface BtTopologyPanelStatsProps {
  locale: AppLocale;
  poles: number;
  transformers: number;
  edges: number;
  totalLengthMeters: number;
  transformerDemandKva: number;
  /** Capacidade nominal do trafo principal (padrão 75 kVA) */
  transformerNominalKva?: number;
  /** Array de comprimentos dos vãos em metros */
  spanLengthsM?: number[];
}

/** Donut SVG compacto para utilização do trafo */
const TrafoDonut: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  const color =
    pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#10b981";
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" aria-label={`Utilização do trafo: ${pct.toFixed(1)}%`}>
      <circle cx={30} cy={30} r={r} fill="none" stroke="currentColor" strokeWidth={7} className="text-slate-100 dark:text-zinc-800" />
      <circle
        cx={30} cy={30} r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={30} y={34} textAnchor="middle" fontSize={10} fontWeight="800" fill={color}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
};

/** Histograma SVG compacto de distribuição de vãos */
const SpanHistogram: React.FC<{ spans: number[] }> = ({ spans }) => {
  if (!spans.length) return <div className="text-[9px] text-slate-400 italic">Sem vãos</div>;

  const buckets = [0, 0, 0, 0, 0];
  const labels = ["<30", "30-50", "50-70", "70-100", ">100"];
  spans.forEach(s => {
    if (s < 30) buckets[0]++;
    else if (s < 50) buckets[1]++;
    else if (s < 70) buckets[2]++;
    else if (s < 100) buckets[3]++;
    else buckets[4]++;
  });
  const maxVal = Math.max(...buckets, 1);
  const barW = 14;
  const barGap = 4;
  const svgW = buckets.length * (barW + barGap) - barGap;
  const svgH = 36;
  const colors = ["#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b"];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-label="Histograma de vãos">
        {buckets.map((val, i) => {
          const barH = Math.max((val / maxVal) * (svgH - 4), 2);
          const x = i * (barW + barGap);
          const y = svgH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={colors[i]} opacity={0.85} />
              {val > 0 && (
                <text x={x + barW / 2} y={y - 1} textAnchor="middle" fontSize={7} fill={colors[i]} fontWeight="700">
                  {val}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex gap-[2px] text-[7px] font-bold text-slate-400 dark:text-zinc-600">
        {labels.map((l, i) => (
          <span key={i} style={{ width: barW, textAlign: "center" }}>{l}</span>
        ))}
      </div>
    </div>
  );
};

const BtTopologyPanelStats: React.FC<BtTopologyPanelStatsProps> = ({
  locale,
  poles,
  transformers,
  edges,
  totalLengthMeters,
  transformerDemandKva,
  transformerNominalKva = 75,
  spanLengthsM = [],
}) => {
  const t = getBtTopologyPanelText(locale).stats;
  const utilPct = transformerNominalKva > 0
    ? (transformerDemandKva / transformerNominalKva) * 100
    : 0;

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Row 1 – counts */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          <Hash size={10} className="text-blue-500" />
          {t.componentsTitle}
        </div>
        <div className="flex items-center gap-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {poles}P
          </span>
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" /> {transformers}T
          </span>
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {edges}V
          </span>
          <span className="ml-1 text-[10px] text-slate-400 font-bold">{totalLengthMeters.toFixed(0)}m</span>
        </div>
      </div>

      {/* Row 2 – charts side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Trafo donut */}
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50">
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t.trafoUtilTitle}
          </div>
          <TrafoDonut pct={utilPct} />
          <div className="mt-2 text-[10px] font-black text-slate-700 dark:text-slate-300">
            {transformerDemandKva.toFixed(1)} <span className="text-slate-400 dark:text-zinc-600 font-bold">/ {transformerNominalKva} kVA</span>
          </div>
        </div>

        {/* Span histogram */}
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50">
          <div className="mb-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <Activity size={10} className="text-indigo-500" />
            {t.spansTitle}
          </div>
          {spanLengthsM.length > 0 ? (
            <SpanHistogram spans={spanLengthsM} />
          ) : (
            <div className="flex h-12 items-center text-[10px] italic text-slate-300 dark:text-zinc-700 font-bold">
              sem dados
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BtTopologyPanelStats;
