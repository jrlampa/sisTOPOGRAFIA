import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    DollarSign,
    Droplets,
    Sun,
    Zap,
    LayoutDashboard,
    X,
    ArrowRight
} from 'lucide-react';
import { AnalysisStats, EconomicData } from '../../types';

interface EnterpriseDashboardProps {
    isVisible: boolean;
    onClose: () => void;
    stats: AnalysisStats | null;
    economics: EconomicData | null;
}

const EnterpriseDashboard: React.FC<EnterpriseDashboardProps> = ({
    isVisible,
    onClose,
    stats,
    economics
}) => {
    if (!isVisible || !stats) return null;

    const cards = [
        {
            title: 'Impacto Econômico',
            value: `R$ ${economics?.breakdown.summary.total_capex.toLocaleString('pt-BR') || '---'}`,
            icon: <DollarSign size={20} className="text-emerald-400" />,
            detail: `${economics?.breakdown.earthwork.total.toLocaleString('pt-BR')} em terraplanagem`,
            color: 'bg-emerald-500/10'
        },
        {
            title: 'Economia Solar',
            value: `R$ ${economics?.breakdown.summary.solar_annual_saving.toLocaleString('pt-BR') || '---'}`,
            icon: <Sun size={20} className="text-amber-400" />,
            detail: 'Estimativa de economia anual',
            color: 'bg-amber-500/10'
        },
        {
            title: 'Drenagem Estimada',
            value: `${economics?.breakdown.drainage.estimated_length_m || 0} m`,
            icon: <Droplets size={20} className="text-blue-400" />,
            detail: `Infraestrutura: R$ ${economics?.breakdown.drainage.cost.toLocaleString('pt-BR')}`,
            color: 'bg-blue-500/10'
        },
        {
            title: 'Complexidade',
            value: `${stats.avgSlope.toFixed(1)}%`,
            icon: <TrendingUp size={20} className="text-purple-400" />,
            detail: 'Declividade média do terreno',
            color: 'bg-purple-500/10'
        }
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed bottom-6 right-6 w-[400px] z-50 overflow-hidden rounded-3xl border border-white/20 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/10"
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <LayoutDashboard size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Dashboard Executivo</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Topografia & ROI</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                        title="Fechar Dashboard"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                        {cards.map((card, idx) => (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`p-4 rounded-2xl border border-white/5 ${card.color} group hover:border-white/20 transition-all cursor-default`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="p-2 rounded-lg bg-white/5">{card.icon}</div>
                                    <ArrowRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                                </div>
                                <div>
                                    <h4 className="text-slate-400 text-xs font-medium uppercase tracking-tighter">{card.title}</h4>
                                    <div className="text-2xl font-bold text-white mt-1 leading-none">{card.value}</div>
                                    <p className="text-[10px] text-slate-500 mt-2 font-mono italic">{card.detail}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                        <div className="flex items-center gap-2 text-indigo-400 mb-2">
                            <Zap size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Resumo Volumétrico</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-indigo-300/60 uppercase">Corte Neto</p>
                                <p className="text-lg font-bold text-indigo-100">{stats.cutVolume.toLocaleString('pt-BR')} m³</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-amber-300/60 uppercase">Aterro Neto</p>
                                <p className="text-lg font-bold text-amber-100">{stats.fillVolume.toLocaleString('pt-BR')} m³</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em]">sisTOPOGRAFIA Enterprise Engine v2.5D</p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default EnterpriseDashboard;
