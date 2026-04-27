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
      const ExcelJS = await import("exceljs");
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet =
        workbook.getWorksheet("RAMAL") || workbook.getWorksheet(1);

      if (!worksheet) return;

      let raw = "";
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues: string[] = [];
        // exceljs col numbers are 1-indexed
        const rowCount = row.cellCount;
        for (let i = 1; i <= rowCount; i++) {
          const cell = row.getCell(i);
          rowValues.push(cell.text ? cell.text.trim() : "");
        }
        raw += rowValues.join("\t") + "\n";
      });

      const sanitizedRaw = sanitizeWorkbookText(raw);
      setBulkRamalText(sanitizedRaw);
      applyBulkRamalInsertFromRaw(sanitizedRaw);
    } catch (err) {
      console.error("Falha ao ler arquivo Excel", err);
      setBulkRamalFeedback("Falha ao ler arquivo Excel.");
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
