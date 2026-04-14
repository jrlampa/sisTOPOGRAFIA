import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { GlobalState } from "../types";
import Toast, { ToastType } from "./Toast";
import ProgressIndicator from "./ProgressIndicator";
import { SessionRecoveryBanner } from "./SessionRecoveryBanner";
import { DxfProgressBadge } from "./DxfProgressBadge";
import { BtExportSummaryBanner } from "./BtExportSummaryBanner";

type Props = {
  toast: { message: string; type: ToastType } | null;
  closeToast: () => void;
  sessionDraft: GlobalState | null;
  handleRestoreSession: () => void;
  handleDismissSession: () => void;
  isProcessing: boolean;
  isDownloading: boolean;
  progressValue: number;
  statusMessage: string;
  showDxfProgress: boolean;
  dxfProgressLabel: string;
  btExportSummaryProps: React.ComponentProps<typeof BtExportSummaryBanner>;
};

export function AppStatusStack({
  toast,
  closeToast,
  sessionDraft,
  handleRestoreSession,
  handleDismissSession,
  isProcessing,
  isDownloading,
  progressValue,
  statusMessage,
  showDxfProgress,
  dxfProgressLabel,
  btExportSummaryProps,
}: Props) {
  const [isBtSummaryVisible, setIsBtSummaryVisible] = useState(true);

  useEffect(() => {
    if (
      btExportSummaryProps.latestBtExport ||
      btExportSummaryProps.btExportHistory.length > 0
    ) {
      setIsBtSummaryVisible(true);
    }
  }, [
    btExportSummaryProps.latestBtExport?.btContextUrl,
    btExportSummaryProps.btExportHistory.length,
  ]);

  return (
    <>
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onClose={closeToast}
            duration={toast.type === "error" ? 8000 : 4000}
          />
        )}
      </AnimatePresence>

      <SessionRecoveryBanner
        sessionDraft={sessionDraft}
        onRestore={handleRestoreSession}
        onDismiss={handleDismissSession}
      />

      <ProgressIndicator
        isVisible={isProcessing || isDownloading}
        progress={progressValue}
        message={statusMessage}
      />

      <DxfProgressBadge visible={showDxfProgress} label={dxfProgressLabel} />

      {isBtSummaryVisible && (
        <BtExportSummaryBanner
          {...btExportSummaryProps}
          onClose={() => setIsBtSummaryVisible(false)}
        />
      )}
    </>
  );
}
