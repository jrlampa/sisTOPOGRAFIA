import React from 'react';
import { Palette } from 'lucide-react';
import { motion } from 'framer-motion';

const LEGEND_ITEMS = [
  { label: 'EDIFÍCIOS', colorClass: 'bg-yellow-300', layer: 'Amarelo' },
  { label: 'RODOVIAS', colorClass: 'bg-red-500', layer: 'Vermelho' },
  { label: 'VIAS PRINCIPAIS', colorClass: 'bg-fuchsia-500', layer: 'Magenta' },
  { label: 'VIAS LOCAIS', colorClass: 'bg-orange-500', layer: 'Laranja' },
  { label: 'VEGETAÇÃO', colorClass: 'bg-lime-500', layer: 'Verde' },
  { label: 'HIDROGRAFIA', colorClass: 'bg-blue-600', layer: 'Azul' },
  { label: 'INFRAESTRUTURA', colorClass: 'bg-cyan-400', layer: 'Ciano' },
  { label: 'TERRENO / CURVAS', colorClass: 'bg-slate-400', layer: 'Cinza' },
];

const DxfLegend: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border-2 border-purple-500/10 bg-white p-6 shadow-sm dark:bg-zinc-950"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
          <Palette size={18} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-xs font-black text-purple-800/60 uppercase tracking-widest dark:text-purple-400/60">
            Standardization
          </h3>
          <span className="text-sm font-black text-purple-950 dark:text-purple-100 uppercase tracking-tight">
            Padrão de Cores DXF
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {LEGEND_ITEMS.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group flex items-center gap-3 cursor-default"
          >
            <div
              className={`h-3 w-3 rounded-full shadow-lg ring-2 ring-white transition-transform group-hover:scale-125 dark:ring-zinc-900 ${item.colorClass}`}
            />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-bold text-slate-900 transition-colors group-hover:text-purple-600 dark:text-zinc-200 dark:group-hover:text-purple-400 uppercase">
                {item.label}
              </span>
              <span className="text-xs font-black uppercase tracking-tighter text-slate-400">
                L: {item.layer}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default DxfLegend;
