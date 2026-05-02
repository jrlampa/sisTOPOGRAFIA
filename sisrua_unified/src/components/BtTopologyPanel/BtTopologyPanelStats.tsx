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
      <circle cx={30} cy={30} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
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

  // Buckets: <30m, 30-50m, 50-70m, 70-100m, >100m
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
      <div className="flex gap-[2px] text-[7px] font-bold text-slate-400">
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
    <div className="flex flex-col gap-3">
      {/* Row 1 – counts */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
          <Hash size={9} className="text-blue-500" />
          {t.componentsTitle}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-600">
          <span className="flex items-center gap-0.5">
            <Circle size={8} className="fill-blue-500 text-blue-500" /> {poles}P
          </span>
          <span className="flex items-center gap-0.5">
            <Circle size={8} className="fill-fuchsia-500 text-fuchsia-500" /> {transformers}T
          </span>
          <span className="flex items-center gap-0.5">
            <Circle size={8} className="fill-emerald-500 text-emerald-500" /> {edges}V
          </span>
          <span className="ml-1 text-slate-400">{totalLengthMeters.toFixed(0)}m</span>
        </div>
      </div>

      {/* Row 2 – charts side by side */}
      <div className="grid grid-cols-2 gap-2">
        {/* Trafo donut */}
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            {t.trafoUtilTitle}
          </div>
          <TrafoDonut pct={utilPct} />
          <div className="mt-1 text-[9px] font-bold text-slate-600">
            {transformerDemandKva.toFixed(1)} / {transformerNominalKva} kVA
          </div>
        </div>

        {/* Span histogram */}
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            <Activity size={9} className="text-indigo-500" />
            {t.spansTitle}
          </div>
          {spanLengthsM.length > 0 ? (
            <SpanHistogram spans={spanLengthsM} />
          ) : (
            <div className="flex h-12 items-center text-[9px] italic text-slate-300">
              sem dados
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BtTopologyPanelStats;
