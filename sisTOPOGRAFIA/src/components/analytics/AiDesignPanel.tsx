import React from 'react';
import { Sparkles, X, ChevronRight, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AiDesignPanelProps {
    isVisible: boolean;
    onClose: () => void;
    suggestion: string | null;
}

const AiDesignPanel: React.FC<AiDesignPanelProps> = ({ isVisible, onClose, suggestion }) => {
    if (!suggestion) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    className="fixed right-0 top-20 bottom-0 w-[450px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-[100] shadow-2xl flex flex-col"
                >
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/20 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black tracking-widest uppercase text-white">Analista de IA</h2>
                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Diretrizes de Projeto</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                            title="Fechar Analista IA"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                        <div className="prose prose-invert prose-sm max-w-none">
                            {/* Simple Markdown-ish Rendering */}
                            {suggestion.split('\n').map((line, i) => {
                                if (line.startsWith('###')) {
                                    return <h3 key={i} className="text-indigo-400 font-black mt-6 mb-3 uppercase tracking-wider text-xs border-b border-indigo-500/20 pb-1">{line.replace('###', '').trim()}</h3>;
                                }
                                if (line.startsWith('**')) {
                                    return <p key={i} className="text-slate-200 mb-2 leading-relaxed"><span className="text-indigo-300 font-bold">{line.match(/\*\*(.*?)\*\*/)?.[1]}</span> {line.replace(/\*\*(.*?)\*\*/, '').trim()}</p>;
                                }
                                if (line.trim().startsWith('-') || line.trim().match(/^\d\./)) {
                                    return (
                                        <div key={i} className="flex gap-3 mb-3 group">
                                            <ChevronRight size={14} className="mt-1 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                                            <p className="text-slate-300 text-sm leading-relaxed flex-1">{line.replace(/^[- \d.]+/, '').trim()}</p>
                                        </div>
                                    );
                                }
                                return line.trim() ? <p key={i} className="text-slate-400 text-sm mb-4 leading-relaxed">{line}</p> : <br key={i} />;
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-slate-900/50">
                        <button
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all"
                            onClick={() => {
                                const blob = new Blob([suggestion], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'ia_analise_design.md';
                                a.click();
                            }}
                        >
                            <Download size={16} />
                            Exportar Relatório IA
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AiDesignPanel;
