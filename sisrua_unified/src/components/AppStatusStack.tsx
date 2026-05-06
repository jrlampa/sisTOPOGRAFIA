import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { GlobalState, AppLocale } from "../types";
import Toast, { ToastType } from "./Toast";
import ProgressIndicator from "./ProgressIndicator";
import { SessionRecoveryBanner } from "./SessionRecoveryBanner";
import { DxfProgressBadge } from "./DxfProgressBadge";
import { BtExportSummaryBanner } from "./BtExportSummaryBanner";

type Props = {
  locale: AppLocale;
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    action?: { label: string; onClick: () => void };
  }>;
  closeToast: (id?: string) => void;
  sessionDraft: GlobalState | null;
  handleRestoreSession: () => void;
  handleDismissSession: () => void;
  isProcessing: boolean;
  isDownloading: boolean;
  progressValue: number;
  statusMessage: string;
  showDxfProgress: boolean;
  dxfProgressLabel: string;
  dxfProgressValue: number;
  dxfProgressStatus: string | null;
  btExportSummaryProps: React.ComponentProps<typeof BtExportSummaryBanner>;
};

export function AppStatusStack({
  locale,
  toasts,
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
  dxfProgressValue,
  dxfProgressStatus,
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
    btExportSummaryProps.latestBtExport,
    btExportSummaryProps.btExportHistory.length,
  ]);

  return (
    <>
      <AnimatePresence>
        {toasts.map((t, index) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => closeToast(t.id)}
            duration={t.type === "error" ? 8000 : 4000}
            action={t.action}
            stackOffset={index}
          />
        ))}
      </AnimatePresence>

      <SessionRecoveryBanner
        locale={locale}
        sessionDraft={sessionDraft}
        onRestore={handleRestoreSession}
        onDismiss={handleDismissSession}
      />

      <ProgressIndicator
        isVisible={isProcessing || isDownloading}
        progress={progressValue}
        message={statusMessage}
      />

      <DxfProgressBadge
        visible={showDxfProgress}
        label={dxfProgressLabel}
        progress={dxfProgressValue}
        status={dxfProgressStatus}
        locale={locale}
      />

      {isBtSummaryVisible && (
        <BtExportSummaryBanner
          {...btExportSummaryProps}
          onClose={() => setIsBtSummaryVisible(false)}
        />
      )}
    </>
  );
}
