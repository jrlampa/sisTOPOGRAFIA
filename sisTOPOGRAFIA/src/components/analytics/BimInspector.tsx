import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Database, MapPin, Ruler, Mountain } from 'lucide-react';

interface BimInspectorProps {
    isVisible: boolean;
    onClose: () => void;
    selectedFeature: any | null;
}

const BimInspector: React.FC<BimInspectorProps> = ({ isVisible, onClose, selectedFeature }) => {
    if (!selectedFeature) return null;

    const tags = selectedFeature.properties || {};

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    className="fixed right-6 top-24 w-80 glass border border-white/10 rounded-3xl shadow-2xl z-40 overflow-hidden flex flex-col max-h-[calc(100vh-120px)]"
                >
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-blue-600/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                                <Database size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white leading-tight uppercase tracking-wider">BIM Inspector</h3>
                                <p className="text-[10px] text-slate-400 font-bold">METADADOS DA ENTIDADE</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            title="Fechar Inspetor"
                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto scrollbar-hide flex flex-col gap-6">
                        {/* Essential Metrics */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 text-slate-500">
                                    <Mountain size={12} />
                                    <span className="text-[9px] font-black uppercase">Declividade</span>
                                </div>
                                <div className="text-sm font-mono font-bold text-blue-400">
                                    {tags.declividade_pct ? `${parseFloat(tags.declividade_pct).toFixed(1)}%` : 'N/A'}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 text-slate-500">
                                    <MapPin size={12} />
                                    <span className="text-[9px] font-black uppercase">Orientação</span>
                                </div>
                                <div className="text-sm font-mono font-bold text-emerald-400">
                                    {tags.orientacao_deg ? `${parseFloat(tags.orientacao_deg).toFixed(0)}°` : 'N/A'}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 text-slate-500">
                                    <Ruler size={12} />
                                    <span className="text-[9px] font-black uppercase">Drenagem</span>
                                </div>
                                <div className="text-sm font-mono font-bold text-cyan-400">
                                    {tags.fluxo_acumulado ? `${parseFloat(tags.fluxo_acumulado).toFixed(0)} pts` : 'N/A'}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 text-slate-500">
                                    <Info size={12} />
                                    <span className="text-[9px] font-black uppercase">Insolação</span>
                                </div>
                                <div className="text-sm font-mono font-bold text-yellow-500">
                                    {tags.potencial_solar ? `${(parseFloat(tags.potencial_solar) * 100).toFixed(0)}%` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Tag List */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Atributos OSM</label>
                            <div className="flex flex-col gap-1.5">
                                {Object.entries(tags).map(([key, value]) => {
                                    if (['declividade_pct', 'orientacao_deg', 'fluxo_acumulado', 'potencial_solar', 'geometry'].includes(key)) return null;
                                    return (
                                        <div key={key} className="flex flex-col p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase group-hover:text-blue-400/70 transition-colors">{key}</span>
                                            <span className="text-xs font-medium text-slate-200 truncate">{String(value)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-900/80 mt-auto border-t border-white/5">
                        <button
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10"
                        >
                            GERAR LAUDO TÉCNICO
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BimInspector;
