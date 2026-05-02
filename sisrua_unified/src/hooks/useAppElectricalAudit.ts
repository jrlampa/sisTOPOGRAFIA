import React from "react";

export function useAppElectricalAudit({ settings, selectedAuditElement, setIsAuditOpen, showToast }: any) {
  const [isAuditOpenInternal, setIsAuditOpenInternal] = React.useState(false);

  React.useEffect(() => {
    if (settings.layers.electricalAudit && selectedAuditElement) {
      setIsAuditOpen(true);
    } else {
      setIsAuditOpen(false);
    }
  }, [settings.layers.electricalAudit, selectedAuditElement, setIsAuditOpen]);

  const handleAuditAction = React.useCallback(
    (action: "approve" | "reject", notes: string) => {
      showToast(
        `Auditoria ${action === "approve" ? "aprovada" : "rejeitada"}: ${notes}`,
        action === "approve" ? "success" : "info",
      );
      setIsAuditOpen(false);
    },
    [showToast, setIsAuditOpen],
  );

  return { handleAuditAction };
}
