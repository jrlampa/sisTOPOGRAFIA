import React, { useState } from 'react';
import { X, Shovel, Box, Loader2, ArrowDownToLine, ArrowUpToLine, Hash, Sparkles } from 'lucide-react';
import Logger from '../../utils/logger';

interface EarthworkPanelProps {
    polygonPoints: [number, number][];
    onClose: () => void;
    isDark: boolean;
    onCalculate: (targetZ: number, autoBalance: boolean) => Promise<any>;
}

const EarthworkPanel: React.FC<EarthworkPanelProps> = ({ polygonPoints, onClose, isDark, onCalculate }) => {
    const [targetZ, setTargetZ] = useState<number | ''>('');
    const [isAutoBalance, setIsAutoBalance] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);

    if (polygonPoints.length < 3) return null;

    const handleCalculate = async () => {
        if (!isAutoBalance && targetZ === '') return;
        setIsLoading(true);
        try {
            const data = await onCalculate(isAutoBalance ? 0 : Number(targetZ), isAutoBalance);
            setResult(data);
        } catch (error) {
            Logger.error('Calculation failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`absolute bottom-4 right-4 w-80 z-[450] rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-10 ${isDark ? 'bg-slate-900/90 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'}`}>
            <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-orange-500">
                    <Box size={18} />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Simulador 2.5D de Platô</h3>
                </div>
                <button
                    onClick={onClose}
                    className="hover:bg-white/10 p-1 rounded transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs uppercase tracking-wider font-bold opacity-70">
                            Cota de Projeto (Z)
                        </label>
                        <button
                            onClick={() => {
                                setIsAutoBalance(!isAutoBalance);
                                if (!isAutoBalance) setTargetZ('');
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 space-x-1 rounded text-[10px] font-bold uppercase transition-all ${isAutoBalance
                                    ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                                }`}
                        >
                            <Sparkles size={12} className={isAutoBalance ? "animate-pulse" : ""} />
                            Auto-Volume Zero
                        </button>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            value={targetZ}
                            onChange={(e) => setTargetZ(parseFloat(e.target.value))}
                            placeholder={isAutoBalance ? "Cota será otimizada pela IA..." : "Ex: 850.5"}
                            disabled={isAutoBalance}
                            className={`w-full p-2.5 pl-8 rounded-lg border text-sm focus:outline-none transition-all ${isAutoBalance
                                    ? 'bg-orange-500/5 border-orange-500/30 text-orange-500/70 cursor-not-allowed'
                                    : isDark
                                        ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-2 focus:ring-orange-500/50'
                                        : 'bg-slate-100 border-slate-300 text-slate-800 focus:ring-2 focus:ring-orange-500/50'
                                }`}
                            step="0.5"
                        />
                        <Hash size={14} className={`absolute left-3 top-3 ${isAutoBalance ? 'text-orange-500/50' : 'opacity-50'}`} />
                        {!isAutoBalance && <span className="absolute right-3 top-2.5 text-xs opacity-50 font-bold">m</span>}
                    </div>
                </div>

                <button
                    onClick={handleCalculate}
                    disabled={isLoading || (!isAutoBalance && targetZ === '')}
                    className="w-full relative flex justify-center items-center py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-orange-500/20"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Calcular Movimento de Terra'}
                </button>

                {result && (
                    <div className="pt-3 border-t border-white/10 space-y-3 animate-in fade-in zoom-in duration-300">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                                <div className="flex items-center gap-1 text-red-400 mb-1">
                                    <ArrowDownToLine size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Corte / Escavação</span>
                                </div>
                                <div className="font-mono font-bold text-lg text-red-50">{result.cut.toFixed(2)} m³</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                                <div className="flex items-center gap-1 text-emerald-400 mb-1">
                                    <ArrowUpToLine size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Aterro</span>
                                </div>
                                <div className="font-mono font-bold text-lg text-emerald-50">{result.fill.toFixed(2)} m³</div>
                            </div>
                        </div>

                        <div className={`p-2 rounded-lg text-xs font-bold text-center border ${result.cut > result.fill
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : result.fill > result.cut
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                            }`}
                        >
                            Saldo Líquido: {Math.abs(result.cut - result.fill).toFixed(2)} m³ ({result.cut > result.fill ? 'Bota-Fora' : result.fill > result.cut ? 'Empréstimo' : 'Balanço Zero / Ideal'})

                            {result.stats && result.stats.optimized_z && (
                                <div className="mt-2 pt-2 border-t border-current/20 font-bold uppercase tracking-widest text-[10px]">
                                    Cota Z Sugerida: <span className="text-sm font-black">{result.stats.target_z?.toFixed(2)}m</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EarthworkPanel;
