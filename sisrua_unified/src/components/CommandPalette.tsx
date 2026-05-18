import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, CornerDownLeft, MapPin } from "lucide-react";
import { fade, fadeSlideUp } from "../theme/motion";
import type { AppLocale } from "../types";
import { trackCommandPalette, trackPoleFocus } from "../utils/analytics";
import { getAppHeaderText } from "../i18n/appHeaderText";

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
  /** BT poles available for semantic navigation (UX-20 / Item 26) */
  poles?: Array<{ id: string; label?: string }>;
  onGoToPole?: (poleId: string) => void;
  locale?: AppLocale;
}

export function CommandPalette({
  isOpen,
  onClose,
  actions,
  poles,
  onGoToPole,
  locale,
}: CommandPaletteProps) {
  const [query, setSearchQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const t = React.useMemo(
    () => getAppHeaderText(locale || "pt-BR"),
    [locale],
  );
  const normalizedQuery = query.trim().toLowerCase();

  // i18n strings for the palette UI
  const i18n = React.useMemo(() => {
    if (locale === "en-US")
      return {
        placeholder: "Search commands… (e.g. 'save', 'pole 1234')",
        navSection: "Navigation",
        goToPole: (id: string) => `Go to pole ${id}`,
        noResults: "No commands found",
        noResultsHint: "Try different keywords.",
      };
    if (locale === "es-ES")
      return {
        placeholder: "Buscar comando… (ej: 'guardar', 'poste 1234')",
        navSection: "Navegación",
        goToPole: (id: string) => `Ir al poste ${id}`,
        noResults: "Sin resultados",
        noResultsHint: "Intenta otros términos.",
      };
    return {
      placeholder: "Busque um comando… (ex: 'salvar', 'poste 1234')",
      navSection: "Navegação",
      goToPole: (id: string) => `Ir para poste ${id}`,
      noResults: "Nenhum comando encontrado",
      noResultsHint: "Tente buscar por termos diferentes.",
    };
  }, [locale]);

  // Dynamic pole navigation actions — only materialise when the query targets poles
  const poleActions: CommandPaletteAction[] = React.useMemo(() => {
    if (!poles?.length || !onGoToPole || !normalizedQuery) return [];
    return poles
      .filter((p) => {
        const label = (p.label ?? p.id).toLowerCase();
        return (
          label.includes(normalizedQuery) ||
          p.id.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 8) // cap to avoid overwhelming results
      .map((p) => ({
        id: `goto-pole-${p.id}`,
        label: i18n.goToPole(p.label ?? p.id),
        section: i18n.navSection,
        onSelect: () => {
          trackPoleFocus(p.id, "command_palette");
          onGoToPole(p.id);
        },
      }));
  }, [poles, onGoToPole, normalizedQuery, i18n]);

  const filteredActions = React.useMemo(() => {
    const all = [...actions, ...poleActions];
    if (!normalizedQuery) return actions; // pole actions only when searching
    return all.filter(
      (action) =>
        action.label.toLowerCase().includes(normalizedQuery) ||
        action.section.toLowerCase().includes(normalizedQuery),
    );
  }, [actions, poleActions, normalizedQuery]);

  const groupedActions = React.useMemo(() => {
    const sections = new Map<
      string,
      Array<{ action: CommandPaletteAction; index: number }>
    >();

    filteredActions.forEach((action, index) => {
      const current = sections.get(action.section);
      if (current) {
        current.push({ action, index });
        return;
      }

      sections.set(action.section, [{ action, index }]);
    });

    return Array.from(sections.entries());
  }, [filteredActions]);

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
        setActiveIndex(
          (prev) => (prev + 1) % Math.max(1, filteredActions.length),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (prev) =>
            (prev - 1 + filteredActions.length) %
            Math.max(1, filteredActions.length),
        );
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
                placeholder={i18n.placeholder}
                className="flex-1 border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                value={query}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
              />
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-black text-slate-400 dark:border-white/5 dark:bg-white/5">
                ESC
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <div className="space-y-4">
                  {/* Grouped by section */}
                  {groupedActions.map(([section, sectionActions]) => (
                    <div key={section}>
                      <div className="px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {section}
                      </div>
                      <div className="mt-1 space-y-1">
                        {sectionActions.map(({ action, index }) => {
                            const isSelected = index === activeIndex;
                            return (
                              <button
                                key={action.id}
                                onClick={() => {
                                  trackCommandPalette(query, action.id);
                                  action.onSelect();
                                  onClose();
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all ${
                                  isSelected
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {action.id.startsWith("goto-pole-") ? (
                                    <MapPin
                                      size={14}
                                      className={
                                        isSelected
                                          ? "text-blue-200"
                                          : "text-cyan-500"
                                      }
                                    />
                                  ) : (
                                    <Command
                                      size={14}
                                      className={
                                        isSelected
                                          ? "text-blue-200"
                                          : "text-slate-400"
                                      }
                                    />
                                  )}
                                  <span className="text-xs font-bold">
                                    {action.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {action.shortcut && (
                                    <span
                                      className={`text-xs font-black ${isSelected ? "text-blue-100 opacity-80" : "text-slate-400"}`}
                                    >
                                      {action.shortcut}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <CornerDownLeft
                                      size={12}
                                      className="text-blue-200"
                                    />
                                  )}
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
                  <p className="text-sm font-bold text-slate-500">
                    {i18n.noResults}
                  </p>
                  <p className="text-xs text-slate-400">{i18n.noResultsHint}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/5">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <span className="rounded border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-800">
                    ↑↓
                  </span>{" "}
                  {t.navigate}
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-800">
                    ENTER
                  </span>{" "}
                  {t.execute}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-blue-500 uppercase">
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
