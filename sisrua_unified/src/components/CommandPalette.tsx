import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, CornerDownLeft, X } from "lucide-react";
import { fade, fadeSlideUp } from "../theme/motion";

interface CommandPaletteAction {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
}

export function CommandPalette({ isOpen, onClose, actions }: CommandPaletteProps) {
  const [query, setSearchQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredActions = actions.filter((action) =>
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.section.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredActions[activeIndex]) {
          filteredActions[activeIndex].onSelect();
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredActions, activeIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            variants={fadeSlideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-white/5">
              <Search size={20} className="text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Busque um comando... (ex: 'salvar', 'dxf')"
                className="flex-1 border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                value={query}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
              />
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-400 dark:border-white/5 dark:bg-white/5">
                ESC
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <div className="space-y-4">
                  {/* Grouped by section */}
                  {Array.from(new Set(filteredActions.map(a => a.section))).map(section => (
                    <div key={section}>
                      <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {section}
                      </div>
                      <div className="mt-1 space-y-1">
                        {filteredActions.filter(a => a.section === section).map((action) => {
                          const isSelected = filteredActions.indexOf(action) === activeIndex;
                          return (
                            <button
                              key={action.id}
                              onClick={() => {
                                action.onSelect();
                                onClose();
                              }}
                              onMouseEnter={() => setActiveIndex(filteredActions.indexOf(action))}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all ${
                                isSelected 
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Command size={14} className={isSelected ? "text-blue-200" : "text-slate-400"} />
                                <span className="text-xs font-bold">{action.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {action.shortcut && (
                                  <span className={`text-[10px] font-black ${isSelected ? "text-blue-100 opacity-80" : "text-slate-400"}`}>
                                    {action.shortcut}
                                  </span>
                                )}
                                {isSelected && <CornerDownLeft size={12} className="text-blue-200" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-white/5">
                    <Search size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">Nenhum comando encontrado</p>
                  <p className="text-xs text-slate-400">Tente buscar por termos diferentes.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/5">
               <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span className="rounded border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-800">↑↓</span> Navegar
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="rounded border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-800">ENTER</span> Executar
                  </div>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Power Mode v2.0
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
