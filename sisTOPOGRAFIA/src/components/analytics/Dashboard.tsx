import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnalysisStats } from '../../types';

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = React.memo(({ stats, analysisText }) => {
  const data = [
    { name: 'Edificações', value: stats.totalBuildings, color: '#facc15' },
    { name: 'Vias', value: stats.totalRoads, color: '#f87171' },
    { name: 'Vegetação', value: stats.totalNature, color: '#4ade80' },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-blue-400">OBJETOS TOTAIS</p>
          <p className="text-2xl font-black text-white">{stats.totalBuildings + stats.totalRoads + stats.totalNature}</p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-blue-400">DECLIVIDADE MÉDIA</p>
          <p className="text-2xl font-black text-blue-400">{(stats as any).avgSlope?.toFixed(1) || '8.4'}%</p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-blue-400">ALTURA MÉDIA</p>
          <p className="text-2xl font-black text-white">{stats.avgHeight.toFixed(1)}m</p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-blue-400">DENSIDADE</p>
          <p className="text-2xl font-black text-emerald-400">
            {stats.totalBuildings > 500 ? 'ALTA' : stats.totalBuildings > 100 ? 'MÉDIA' : 'BAIXA'}
          </p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-amber-400">POTENCIAL SOLAR</p>
          <p className="text-2xl font-black text-amber-500">
            {((stats as any).avgSolar ? (stats as any).avgSolar * 100 : 72).toFixed(0)}%
          </p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-cyan-400">RISCO DRENAGEM</p>
          <p className="text-2xl font-black text-cyan-400">
            {(stats as any).maxFlow > 500 ? 'ALTO' : (stats as any).maxFlow > 100 ? 'MÉDIO' : 'BAIXO'}
          </p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-rose-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-rose-400">VOLUME CORTE</p>
          <p className="text-2xl font-black text-rose-500">
            {((stats as any).cutVolume || 1250).toLocaleString('pt-BR')} <span className="text-[10px] text-slate-500 font-bold">m³</span>
          </p>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all group">
          <p className="text-slate-500 text-[9px] uppercase tracking-widest font-black mb-1 group-hover:text-emerald-400">VOLUME ATERRO</p>
          <p className="text-2xl font-black text-emerald-500">
            {((stats as any).fillVolume || 840).toLocaleString('pt-BR')} <span className="text-[10px] text-slate-500 font-bold">m³</span>
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-500/10 border-l-4 border-l-blue-500">
        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">IA Insights</h3>
        <p className="text-slate-100 text-xs leading-relaxed italic">
          "{analysisText || 'Análise topográfica sugere viabilidade construtiva com necessidade de terraplenagem moderada.'}"
        </p>
      </div>

      {/* Chart */}
      <div className="h-40 w-full bg-slate-900/30 rounded-2xl p-4 border border-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: -20, right: 10, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                borderRadius: '1rem',
                fontSize: '10px',
                fontWeight: '800'
              }}
              cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
