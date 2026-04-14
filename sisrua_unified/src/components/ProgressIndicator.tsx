
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressIndicatorProps {
    isVisible: boolean;
    progress: number; // 0 to 100
    message: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ isVisible, progress, message }) => {
    if (!isVisible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-[900] w-[calc(100vw-2rem)] max-w-80 rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900/95 backdrop-blur p-4 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin text-cyan-600 dark:text-cyan-400" size={16} />
                    <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Processando</span>
                </div>
                <span className="text-xs font-mono text-cyan-700 dark:text-cyan-300">{Math.round(progress)}%</span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
                <progress
                    className="h-1.5 w-full [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-cyan-600 [&::-webkit-progress-value]:to-blue-600 [&::-moz-progress-bar]:bg-gradient-to-r [&::-moz-progress-bar]:from-cyan-600 [&::-moz-progress-bar]:to-blue-600"
                    value={Math.min(100, Math.max(0, progress))}
                    max={100}
                    aria-label="Progresso do processamento"
                />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 truncate animate-pulse">
                {message}
            </p>
        </div>
    );
};

export default ProgressIndicator;
