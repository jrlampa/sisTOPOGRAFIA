import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { 
  Building2, 
  Map as MapIcon, 
  TreePine, 
  Ruler, 
  ArrowUpRight, 
  Activity,
  Layers
} from "lucide-react";
import { AnalysisStats } from "../types";

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    { name: "Edificações", value: stats.totalBuildings, color: "#F59E0B" }, // Amber
    { name: "Vias", value: stats.totalRoads, color: "#EF4444" }, // Red
    { name: "Natureza", value: stats.totalNature, color: "#10B981" }, // Emerald
  ];

  const densityColors = {
    "Baixa": "from-emerald-500/20 to-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "Média": "from-amber-500/20 to-amber-600/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "Alta": "from-rose-500/20 to-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
  };

  const currentDensity = stats.density || "Baixa";

  return (
    <div className="flex flex-col gap-6">
      {/* Premium Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Objects */}
        <div className="group relative overflow-hidden rounded-3xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm transition-all hover:shadow-md dark:from-zinc-900 dark:to-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Layers size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600/60 uppercase">
              Total <Activity size={10} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black tracking-tight text-amber-950 dark:text-amber-50">
              {stats.totalBuildings + stats.totalRoads + stats.totalNature}
            </p>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-amber-900/90 dark:text-amber-300">
              Objetos Detectados
            </p>
          </div>
        </div>

        {/* Height Stats */}
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
              <span className="text-base font-bold text-blue-900/60">m</span>
            </div>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-blue-900/90 dark:text-blue-300">
              Altura Máxima
            </p>
          </div>
        </div>

        {/* Avg Height */}
        <div className="group relative overflow-hidden rounded-3xl border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-50 to-sky-50 p-5 shadow-sm transition-all hover:shadow-md dark:from-zinc-900 dark:to-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Building2 size={20} />
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-black tracking-tight text-cyan-950 dark:text-cyan-50">
                {stats.avgHeight.toFixed(1)}
              </p>
              <span className="text-base font-bold text-cyan-900/60">m</span>
            </div>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-cyan-900/90 dark:text-cyan-300">
              Média Vertical
            </p>
          </div>
        </div>

        {/* Density Card */}
        <div className={`group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900 ${densityColors[currentDensity]}`}>
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-current/10 p-3">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">
              Urban Focus
            </span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black tracking-tight">
              {currentDensity}
            </p>
            <p className="text-sm font-black uppercase tracking-[0.15em] opacity-90">
              Densidade Urbana
            </p>
          </div>
        </div>
      </div>

      {/* Narrative Panel */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-fuchsia-500/20 bg-white p-6 dark:bg-zinc-950">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Activity size={80} className="text-fuchsia-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-fuchsia-500" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">
              Relatório de Inteligência Técnica
            </h3>
        </div>
        <p className="relative z-10 text-lg leading-relaxed text-slate-900 dark:text-zinc-50 font-bold tracking-tight">
          {analysisText}
        </p>
      </div>

      {/* Distribution Chart */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Tipologia da Área</span>
            </div>
            <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Edificações</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Vias</span>
                </div>
            </div>
        </div>
        
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: -20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={80}
                tick={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border-2 border-slate-900 bg-slate-900 p-2 text-[10px] font-bold text-white shadow-xl">
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
        
        {/* Custom Legend/Summary */}
        <div className="mt-4 grid grid-cols-3 gap-2">
            {data.map((item) => (
                <div key={item.name} className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-2 dark:bg-zinc-800/50">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{item.name}</span>
                    <span className="text-lg font-black" style={{ color: item.color }}>{item.value}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
