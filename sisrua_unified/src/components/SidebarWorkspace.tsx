import { motion } from 'framer-motion';
import { SidebarAnalysisResults } from './SidebarAnalysisResults';
import { SidebarBtEditorSection } from './SidebarBtEditorSection';
import { SidebarSelectionControls } from './SidebarSelectionControls';

type Props = {
  isSidebarDockedForRamalModal: boolean;
  selectionControlsProps: React.ComponentProps<typeof SidebarSelectionControls>;
  btEditorSectionProps: React.ComponentProps<typeof SidebarBtEditorSection>;
  analysisResultsProps: React.ComponentProps<typeof SidebarAnalysisResults>;
};

export function SidebarWorkspace({
  isSidebarDockedForRamalModal,
  selectionControlsProps,
  btEditorSectionProps,
  analysisResultsProps,
}: Props) {
  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`app-sidebar border-r flex flex-col gap-8 overflow-y-auto z-20 shadow-2xl transition-all duration-300 scrollbar-hide ${
        isSidebarDockedForRamalModal
          ? 'w-0 p-0 opacity-0 pointer-events-none border-r-0'
          : 'w-full max-w-[420px] p-5 md:p-7 opacity-100'
      }`}
      aria-hidden={isSidebarDockedForRamalModal}
    >
      <div className="rounded-2xl border border-emerald-800/10 bg-[var(--surface-soft)] p-4 md:p-5 shadow-sm backdrop-blur-md">
        <SidebarSelectionControls {...selectionControlsProps} />
      </div>

      <div className="rounded-2xl border border-sky-900/10 bg-[var(--surface-soft)] p-4 md:p-5 shadow-sm backdrop-blur-md">
        <SidebarBtEditorSection {...btEditorSectionProps} />
      </div>

      <div className="rounded-2xl border border-amber-900/10 bg-[var(--surface-soft)] p-4 md:p-5 shadow-sm backdrop-blur-md mb-2">
        <SidebarAnalysisResults {...analysisResultsProps} />
      </div>
    </motion.aside>
  );
}
