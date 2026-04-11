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
      className={`app-sidebar border-r flex flex-col gap-8 overflow-y-auto z-20 shadow-2xl transition-all duration-300 scrollbar-hide ${isSidebarDockedForRamalModal ? 'w-0 p-0 opacity-0 pointer-events-none border-r-0' : 'w-[400px] p-8 opacity-100'}`}
      aria-hidden={isSidebarDockedForRamalModal}
    >
      <SidebarSelectionControls {...selectionControlsProps} />

      <SidebarBtEditorSection {...btEditorSectionProps} />

      <SidebarAnalysisResults {...analysisResultsProps} />
    </motion.aside>
  );
}
