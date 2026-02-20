import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, X } from 'lucide-react';

interface HydrologicalProfilePanelProps {
    isVisible: boolean;
    onClose: () => void;
    data: Array<{ distance: number, elevation: number }> | null;
}

const HydrologicalProfilePanel: React.FC<HydrologicalProfilePanelProps> = ({ isVisible, onClose, data }) => {
    if (!isVisible || !data || data.length === 0) return null;

    const minZ = Math.min(...data.map(d => d.elevation));
    const maxZ = Math.max(...data.map(d => d.elevation));
    const diff = maxZ - minZ;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 50 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[800px] z-[500] overflow-hidden rounded-3xl border border-white/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-blue-500/20"
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                            <Activity size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Perfil Longitudinal (Aprox.)</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Seção Transversal Central</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                        title="Fechar Perfil"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Chart Area */}
                <div className="px-6 py-8" style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.1} />
                            <XAxis
                                dataKey="distance"
                                tickFormatter={(val) => `${val}m`}
                                stroke="#94a3b8"
                                fontSize={10}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                domain={[Math.floor(minZ - diff * 0.2), Math.ceil(maxZ + diff * 0.2)]}
                                tickFormatter={(val) => `${val.toFixed(1)}m`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                itemStyle={{ color: '#60a5fa' }}
                                labelStyle={{ color: '#94a3b8' }}
                                formatter={(value: number | string | Array<number | string> | undefined) => {
                                    if (value === undefined) return ['0m', 'Elevação'];
                                    const val = typeof value === 'number' ? value : Number(value);
                                    return [`${val.toFixed(2)}m`, 'Elevação'];
                                }}
                                labelFormatter={(label) => `Distância: ${label}m`}
                            />
                            <Area
                                type="monotone"
                                dataKey="elevation"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorElevation)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Footer */}
                <div className="p-3 bg-white/5 border-t border-white/10 text-center flex justify-between items-center px-6">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest"><span className="text-white font-bold">{minZ.toFixed(1)}m</span> cota mínima</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest"><span className="text-white font-bold">{maxZ.toFixed(1)}m</span> cota máxima</p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default HydrologicalProfilePanel;
