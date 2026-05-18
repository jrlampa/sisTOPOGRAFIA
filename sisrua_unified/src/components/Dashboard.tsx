import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, Ruler, ArrowUpRight, Activity, Layers } from 'lucide-react';
import { AnalysisStats } from '../types';

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

// Palette: 1 brand accent (blue-500) + slate grayscale
const DATA_COLORS = {
  buildings: '#3B82F6', // blue-500 — brand accent
  roads: '#64748B', // slate-500
  nature: '#94A3B8', // slate-400
};

const LEGEND_VALUE_CLASS: Record<string, string> = {
  Edificações: 'text-blue-500',
  Vias: 'text-slate-500',
  Natureza: 'text-slate-400',
};

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    {
      name: 'Edificações',
      value: stats.totalBuildings,
      color: DATA_COLORS.buildings,
    },
    { name: 'Vias', value: stats.totalRoads, color: DATA_COLORS.roads },
    { name: 'Natureza', value: stats.totalNature, color: DATA_COLORS.nature },
  ];

  // Density card keeps semantic colors (communicates meaningful status)
  const densityColors: Record<string, string> = {
    Baixa:
      'from-emerald-500/20 to-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    Média:
      'from-amber-500/20 to-amber-600/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
    Alta: 'from-rose-500/20 to-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
  };

  const currentDensity = stats.density || 'Baixa';

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Objects — slate neutral card, blue accent icon */}
        <div className="group relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Layers size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Total</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              {stats.totalBuildings + stats.totalRoads + stats.totalNature}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Objetos Detectados
            </p>
          </div>
        </div>

        {/* Max Height — blue accent card */}
        <div className="group relative overflow-hidden rounded-3xl border-2 border-blue-500/20 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm transition-all hover:shadow-md dark:from-zinc-900 dark:to-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Ruler size={20} />
            </div>
            <ArrowUpRight size={16} className="text-blue-500/40" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-black tracking-tight text-blue-950 dark:text-blue-50">
                {stats.maxHeight.toFixed(1)}
              </p>
              <span className="text-base font-semibold text-blue-700/60 dark:text-blue-400/60">
                m
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Altura Máxima
            </p>
          </div>
        </div>

        {/* Avg Height — slate neutral card */}
        <div className="group relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-slate-200 p-3 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <Building2 size={20} />
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                {stats.avgHeight.toFixed(1)}
              </p>
              <span className="text-base font-semibold text-slate-500/60">m</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Média Vertical
            </p>
          </div>
        </div>

        {/* Density Card — keeps semantic colors (status indicator) */}
        <div
          className={`group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900 ${densityColors[currentDensity]}`}
        >
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-current/10 p-3">
              <Activity size={20} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-tight opacity-60">
              Densidade
            </span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black tracking-tight">{currentDensity}</p>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
              Densidade Urbana
            </p>
          </div>
        </div>
      </div>

      {/* Narrative Panel */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-blue-500/20 bg-white p-6 dark:bg-zinc-950">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Activity size={80} className="text-blue-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
            Relatório de Inteligência Técnica
          </h3>
        </div>
        <p className="relative z-10 text-base leading-relaxed text-slate-700 dark:text-zinc-300 font-medium">
          {analysisText}
        </p>
      </div>

      {/* Distribution Chart */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Distribuição
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Tipologia da Área
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Edificações</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Vias</span>
            </div>
          </div>
        </div>

        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: -20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} tick={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border-2 border-slate-900 bg-slate-900 p-2 text-xs font-bold text-white shadow-xl">
                        {payload[0].value} {payload[0].name}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={16}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend summary */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {data.map(item => (
            <div
              key={item.name}
              className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-2 dark:bg-zinc-800/50"
            >
              <span className="text-xs font-semibold text-slate-400 uppercase">{item.name}</span>
              <span
                className={`text-lg font-black ${LEGEND_VALUE_CLASS[item.name] ?? 'text-slate-500'}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
