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
import { AnalysisStats } from "../types";

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    { name: "Edificações", value: stats.totalBuildings, color: "#facc15" }, // Yellow
    { name: "Vias", value: stats.totalRoads, color: "#f87171" }, // Red
    { name: "Natureza", value: stats.totalNature, color: "#4ade80" }, // Green
  ];

  return (
    <div className="glass-panel space-y-6 rounded-2xl border-2 p-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel-hover rounded-xl border-2 border-amber-800/25 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-zinc-900">
          <p className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Objetos
          </p>
          <p className="text-2xl font-black text-amber-950 dark:text-amber-100">
            {stats.totalBuildings + stats.totalRoads + stats.totalNature}
          </p>
        </div>
        <div className="glass-panel-hover rounded-xl border-2 border-blue-700/30 bg-blue-50 p-3 dark:border-blue-500/45 dark:bg-blue-950/25">
          <p className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Altura Máx.
          </p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-200">
            {stats.maxHeight.toFixed(1)}m
          </p>
        </div>
        <div className="glass-panel-hover rounded-xl border-2 border-cyan-700/30 bg-cyan-50 p-3 dark:border-cyan-500/45 dark:bg-cyan-950/25">
          <p className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Altura Média
          </p>
          <p className="text-2xl font-black text-cyan-700 dark:text-cyan-200">
            {stats.avgHeight.toFixed(1)}m
          </p>
        </div>
        <div className="glass-panel-hover rounded-xl border-2 border-emerald-700/30 bg-emerald-50 p-3 dark:border-emerald-500/45 dark:bg-emerald-950/25">
          <p className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Densidade
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-200">
            {stats.totalBuildings > 500
              ? "Alta"
              : stats.totalBuildings > 100
                ? "Média"
                : "Baixa"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-fuchsia-700/30 bg-fuchsia-50 p-4 dark:border-fuchsia-500/45 dark:bg-fuchsia-950/20">
        <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-200">
          Resumo da análise
        </h3>
        <p className="text-sm leading-relaxed italic text-fuchsia-900 dark:text-fuchsia-100">
          "{analysisText}"
        </p>
      </div>

      {/* Chart */}
      <div className="h-48 w-full rounded-xl border-2 border-amber-800/25 bg-white p-3 dark:border-amber-500/45 dark:bg-zinc-900">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <BarChart data={data} layout="vertical">
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 247, 226, 0.98)",
                borderColor: "rgba(180, 83, 9, 0.3)",
                color: "#1e293b",
                borderWidth: "2px",
                borderStyle: "solid",
                borderRadius: "0.5rem",
                boxShadow: "4px 4px 0 rgba(124,45,18,0.2)",
              }}
              cursor={{ fill: "rgba(6, 182, 212, 0.05)" }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
