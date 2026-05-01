import type { AppLocale } from "../types";

export function getElectricalAuditDrawerText(locale: AppLocale) {
  const texts = {
    "pt-BR": {
      title: "Auditoria de Cálculo Elétrico",
      btnDetailCalculations: "Detalhar Cálculos",
      btnApprove: "Aprovar Cálculo",
      btnReject: "Rejeitar / Corrigir",
      simulationTitle: "Modo Simulação (What-if)",
      loadMultiplier: "Multiplicador de Carga",
      conductorBitola: "Bitola do Condutor",
      predictionTitle: "Previsão em Tempo Real",
      newTensionDrop: "Nova Queda Tensão",
      auditNotesPlaceholder: "Insira as observações técnicas aqui...",
      bimMetadataTitle: "Metadados BIM",
    },
    "en-US": {
      title: "Electrical Calculation Audit",
      btnDetailCalculations: "Detail Calculations",
      btnApprove: "Approve Calculation",
      btnReject: "Reject / Correct",
      simulationTitle: "Simulation Mode (What-if)",
      loadMultiplier: "Load Multiplier",
      conductorBitola: "Conductor Size",
      predictionTitle: "Real-time Prediction",
      newTensionDrop: "New Voltage Drop",
      auditNotesPlaceholder: "Enter technical observations here...",
      bimMetadataTitle: "BIM Metadata",
    },
    "es-ES": {
      title: "Auditoría de Cálculo Eléctrico",
      btnDetailCalculations: "Detallar Cálculos",
      btnApprove: "Aprobar Cálculo",
      btnReject: "Rechazar / Corregir",
      simulationTitle: "Modo Simulación (What-if)",
      loadMultiplier: "Multiplicador de Carga",
      conductorBitola: "Calibre del Conductor",
      predictionTitle: "Predicción en Tiempo Real",
      newTensionDrop: "Nueva Caída de Tensión",
      auditNotesPlaceholder: "Ingrese las observaciones técnicas aquí...",
      bimMetadataTitle: "Metadatos BIM",
    },
  };

  return texts[locale] || texts["pt-BR"];
}
