import React from "react";
import type { BtTopology } from "../../types";
import {
  buildTopologyWithBulkRamais,
  sanitizeWorkbookText,
} from "./btBulkImportParser";

const ALLOWED_WORKBOOK_EXTENSIONS = [".xlsx", ".xlsm", ".xlsb"];

export interface BulkImportReviewState {
  raw: string;
  topologyFromWorkbook: BtTopology;
  orderedPoleIds: string[];
  currentPoleIndex: number;
  workbookSettingsLabel: string;
}

interface UseBtTopologyPanelBulkImportParams {
  btTopology: BtTopology;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onProjectTypeChange?: (next: "ramais" | "clandestino") => void;
  onClandestinoAreaChange?: (nextAreaM2: number) => void;
}

export const useBtTopologyPanelBulkImport = ({
  btTopology,
  onTopologyChange,
  onSelectedPoleChange,
  onProjectTypeChange: _onProjectTypeChange,
  onClandestinoAreaChange: _onClandestinoAreaChange,
}: UseBtTopologyPanelBulkImportParams) => {
  const [isBulkRamalModalOpen, setIsBulkRamalModalOpen] = React.useState(false);
  const [bulkRamalText, setBulkRamalText] = React.useState("");
  const [bulkRamalFeedback, setBulkRamalFeedback] = React.useState("");
  const [bulkImportReview, setBulkImportReview] =
    React.useState<BulkImportReviewState | null>(null);
  const bulkFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const focusPoleInMap = (poleId: string) => {
    setTimeout(() => onSelectedPoleChange?.(poleId), 0);
  };

  const applyBulkRamalInsertFromRaw = (rawInput: string) => {
    const result = buildTopologyWithBulkRamais(rawInput, btTopology);
    if (!result) {
      setBulkRamalFeedback("Erro ao processar dados de importação.");
      return;
    }
    onTopologyChange(result.nextTopology);
    setBulkRamalFeedback(
      `Importação concluída: ${result.insertedRamais} ramais em ${result.countPoles} postes.`,
    );
  };

  const importBulkRamaisFromWorkbook = async (file: File) => {
    if (
      !ALLOWED_WORKBOOK_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      )
    ) {
      setBulkRamalFeedback("Extensão inválida.");
      return;
    }

    try {
      // Use backend API to parse Excel (removes ExcelJS from frontend bundle)
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/bt/parse-bulk-excel", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const errorData = await response.json();
        setBulkRamalFeedback(
          errorData.error || "Falha ao processar arquivo Excel.",
        );
        return;
      }

      const { success, data, error } = await response.json();

      if (!success || !data) {
        setBulkRamalFeedback(error || "Falha ao processar arquivo Excel.");
        return;
      }

      const sanitizedRaw = sanitizeWorkbookText(data);
      setBulkRamalText(sanitizedRaw);
      applyBulkRamalInsertFromRaw(sanitizedRaw);
    } catch (err) {
      console.error("Falha ao enviar arquivo Excel para processamento", err);
      setBulkRamalFeedback("Falha ao processar arquivo Excel.");
    }
  };

  const handleReviewStep = (nextIndex: number) => {
    if (!bulkImportReview) return;
    if (nextIndex >= bulkImportReview.orderedPoleIds.length) {
      setBulkImportReview(null);
      setBulkRamalFeedback("Revisão concluída.");
      return;
    }
    const poleId = bulkImportReview.orderedPoleIds[nextIndex];
    setBulkImportReview({ ...bulkImportReview, currentPoleIndex: nextIndex });
    focusPoleInMap(poleId);
  };

  return {
    isBulkRamalModalOpen,
    setIsBulkRamalModalOpen,
    bulkRamalText,
    setBulkRamalText,
    bulkRamalFeedback,
    bulkFileInputRef,
    bulkImportReview,
    setBulkImportReview,
    applyBulkRamalInsert: () => applyBulkRamalInsertFromRaw(bulkRamalText),
    importBulkRamaisFromWorkbook,
    handleReviewNext: () =>
      handleReviewStep((bulkImportReview?.currentPoleIndex ?? 0) + 1),
  };
};
