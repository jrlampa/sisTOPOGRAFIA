import React from "react";

export function useAppElectricalAudit({ settings, showToast }: any) {
  const [isAuditOpen, setIsAuditOpen] = React.useState(false);
  const [selectedAuditElement, setSelectedAuditElement] = React.useState<any>(null);

  React.useEffect(() => {
    if (settings.layers.electricalAudit && selectedAuditElement) {
      setIsAuditOpen(true);
    } else {
      setIsAuditOpen(false);
    }
  }, [settings.layers.electricalAudit, selectedAuditElement]);

  const handleAuditAction = React.useCallback(
    (action: "approve" | "reject", notes: string) => {
      showToast(
        `Auditoria ${action === "approve" ? "aprovada" : "rejeitada"}: ${notes}`,
        action === "approve" ? "success" : "info",
      );
      setIsAuditOpen(false);
    },
    [showToast],
  );

  return { 
    isAuditOpen, 
    setIsAuditOpen, 
    selectedAuditElement, 
    setSelectedAuditElement,
    handleAuditAction 
  };
}
