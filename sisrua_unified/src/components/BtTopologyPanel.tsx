import React from "react";
import { Activity, Plus, Trash2, Sigma, ChevronDown } from "lucide-react";
import {
  BtEdge,
  BtNetworkScenario,
  BtPoleNode,
  BtPoleRamalEntry,
  BtTopology,
  BtTransformer,
  BtTransformerReading,
} from "../types";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";
import { useBtTopologySelection } from "../hooks/useBtTopologySelection";
import { LEGACY_ID_ENTROPY } from "../constants/magicNumbers";
import {
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR,
} from "../constants/btPhysicalConstants";
import type { CriticalConfirmationConfig } from "./BtModals";

interface BtTopologyPanelProps {
  btTopology: BtTopology;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  pointDemandKva: number;
  projectType: "ramais" | "geral" | "clandestino";
  btNetworkScenario: BtNetworkScenario;
  clandestinoAreaM2: number;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  transformerDebugById?: Record<
    string,
    { assignedClients: number; estimatedDemandKw: number }
  >;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onProjectTypeChange?: (next: "ramais" | "clandestino") => void;
  onClandestinoAreaChange?: (nextAreaM2: number) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
}

interface BulkImportReviewState {
  raw: string;
  topologyFromWorkbook: BtTopology;
  orderedPoleIds: string[];
  currentPoleIndex: number;
  workbookSettingsLabel: string;
}

import {
  BtEdgeChangeFlag,
  BtPoleChangeFlag,
  BtTransformerChangeFlag,
  getEdgeChangeFlag,
  getPoleChangeFlag,
  getTransformerChangeFlag,
  NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE,
  CONDUCTOR_NAMES,
  numberFromInput,
  selectAllInputText,
  normalizeNumericClipboardText,
  formatBr,
  parseBr,
  nextId,
  NumericTextInput,
} from "./BtTopologyPanel/BtTopologyPanelUtils";

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  accumulatedByPole,
  summary,
  pointDemandKva,
  projectType,
  btNetworkScenario,
  clandestinoAreaM2,
  clandestinoDisplay,
  transformersDerived,
  transformerDebugById = {},
  onTopologyChange,
  onSelectedPoleChange,
  onSelectedTransformerChange,
  onSelectedEdgeChange,
  onBtSetEdgeChangeFlag,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtSetTransformerChangeFlag,
  onProjectTypeChange,
  onClandestinoAreaChange,
  onBtRenamePole,
  onBtRenameTransformer,
  onRequestCriticalConfirmation,
}) => {
  const {
    selectedPoleId,
    selectedTransformerId,
    selectedEdgeId,
    selectedPole,
    selectedTransformer,
    selectedEdge,
    isPoleDropdownOpen,
    isTransformerDropdownOpen,
    setIsPoleDropdownOpen,
    setIsTransformerDropdownOpen,
    selectPole,
    selectTransformer,
    selectEdge,
  } = useBtTopologySelection({
    btTopology,
    onSelectedPoleChange,
    onSelectedTransformerChange,
    onSelectedEdgeChange,
  });

  const [isBulkRamalModalOpen, setIsBulkRamalModalOpen] = React.useState(false);
  const [bulkRamalText, setBulkRamalText] = React.useState("");
  const [bulkRamalFeedback, setBulkRamalFeedback] = React.useState("");
  const [isBulkDropActive, setIsBulkDropActive] = React.useState(false);
  const [bulkImportReview, setBulkImportReview] =
    React.useState<BulkImportReviewState | null>(null);
  const bulkFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const focusPoleInMap = (poleId: string) => {
    setTimeout(() => {
      onSelectedPoleChange?.(poleId);
    }, 0);
  };

  const normalizeHeaderKey = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replace(/[_.-]/g, "")
      .toUpperCase();

  const resolveRamalTypeFromHeader = (header: string): string | null => {
    const key = normalizeHeaderKey(header);

    if (key.includes("13DX") || key.includes("13ALDX")) return "13 DX 6 AWG";
    if (key.includes("13TX") || key.includes("13ALTX")) return "13 TX 6 AWG";
    if (key.includes("13QX") || key.includes("13ALQX")) return "13 QX 6 AWG";
    if (key.includes("21QX")) return "21 QX 4 AWG";
    if (key.includes("53QX")) return "53 QX 1/0";
    if (key.includes("107QX")) return "107 QX 4/0";
    if (key.includes("70MMX")) return "70 MMX";
    if (key.includes("185MMX")) return "185 MMX";
    if (key === "70" || key.endsWith("70")) return "70 MMX";
    if (key === "185" || key.endsWith("185")) return "185 MMX";

    return null;
  };
  const parseBulkRamalQuantity = (value: string | undefined): number => {
    if (!value) {
      return 0;
    }
    const cleaned = value.trim().replace(/[^0-9]/g, "");
    if (!cleaned) {
      return 0;
    }
    const parsed = Number.parseInt(cleaned, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const extractPointNumber = (value: string): string | null => {
    const token = value.match(/\d+/)?.[0] ?? "";
    return token.length > 0 ? token : null;
  };

  const parseWorkbookNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().replace(/\./g, "").replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const parseWorkbookProjectSettings = (
    workbook: any,
  ): {
    projectType: "ramais" | "clandestino";
    clandestinoAreaM2: number;
    geralI2Raw: string;
  } | null => {
    const geralName = workbook.SheetNames.find((name: string) =>
      normalizeHeaderKey(name).startsWith("GERAL"),
    );
    if (!geralName) {
      return null;
    }

    const sheet = workbook.Sheets[geralName];
    const i2Raw = String(sheet?.["I2"]?.v ?? "");
    const i2 = normalizeHeaderKey(i2Raw);
    const isClandestino = ["SIM", "S", "YES", "TRUE", "1"].includes(i2);

    const parsedArea = parseWorkbookNumber(sheet?.["L2"]?.v);
    const clandestinoAreaM2 = Math.max(0, Math.round(parsedArea ?? 0));

    return {
      projectType: isClandestino ? "clandestino" : "ramais",
      clandestinoAreaM2,
      geralI2Raw: i2Raw,
    };
  };

  const buildTopologyWithBulkRamais = (
    rawInput: string,
    sourceTopology: BtTopology,
  ): { nextTopology: BtTopology; feedback: string } | null => {
    const raw = rawInput.trim();
    if (!raw) {
      setBulkRamalFeedback("Cole uma tabela antes de aplicar.");
      return null;
    }

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      setBulkRamalFeedback(
        "Dados insuficientes. Inclua cabecalho e ao menos uma linha.",
      );
      return null;
    }

    const splitCells = (line: string) =>
      line.includes("\t") ? line.split("\t") : line.split(";");

    const table = lines.map((line) =>
      splitCells(line).map((cell) => cell.trim()),
    );

    const baseTopology = sourceTopology;
    const headerIndex = table.findIndex((cells) => {
      const first = normalizeHeaderKey(cells[0] ?? "");
      return (
        first.includes("POSTE") ||
        first === "NDOPOSTE" ||
        first === "NUMEROPOSTE"
      );
    });

    const effectiveHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
    const headers = table[effectiveHeaderIndex] ?? [];
    const headerPrev =
      effectiveHeaderIndex > 0 ? (table[effectiveHeaderIndex - 1] ?? []) : [];
    const headerNext =
      effectiveHeaderIndex + 1 < table.length
        ? (table[effectiveHeaderIndex + 1] ?? [])
        : [];
    const columnToRamalType = new Map<number, string>();

    headers.forEach((header, index) => {
      if (index === 0) {
        return;
      }

      const candidateHeaders = [
        header,
        `${headerPrev[index] ?? ""} ${header}`.trim(),
        `${header} ${headerNext[index] ?? ""}`.trim(),
        `${headerPrev[index] ?? ""} ${header} ${headerNext[index] ?? ""}`.trim(),
      ].filter(
        (candidate, idx, arr) => candidate && arr.indexOf(candidate) === idx,
      );

      let ramalType: string | null = null;
      for (const candidate of candidateHeaders) {
        ramalType = resolveRamalTypeFromHeader(candidate);
        if (ramalType) {
          break;
        }
      }

      if (ramalType) {
        columnToRamalType.set(index, ramalType);
      }
    });

    if (columnToRamalType.size === 0) {
      setBulkRamalFeedback(
        "Nao foi possivel reconhecer colunas de ramal. Verifique o cabecalho colado.",
      );
      return null;
    }

    const poleById = new Map(
      baseTopology.poles.map((pole) => [pole.id.toUpperCase(), pole]),
    );
    const poleByNumber = new Map<string, BtPoleNode>();
    for (const pole of baseTopology.poles) {
      const idDigits = pole.id.match(/\d+/)?.[0];
      if (idDigits) {
        poleByNumber.set(idDigits, pole);
      }
      const titleDigits = pole.title.match(/\d+/)?.[0];
      if (titleDigits) {
        poleByNumber.set(titleDigits, pole);
      }
    }

    const appendByPoleId = new Map<string, BtPoleRamalEntry[]>();
    const notFoundPoles: string[] = [];
    let insertedRamais = 0;

    const dataRows = table.slice(effectiveHeaderIndex + 1);
    for (const row of dataRows) {
      const poleTokenRaw = (row[0] ?? "").trim();
      if (!poleTokenRaw) {
        continue;
      }

      const poleTokenUpper = poleTokenRaw.toUpperCase();
      const poleNumber = poleTokenRaw.match(/\d+/)?.[0] ?? "";
      const pole =
        poleById.get(poleTokenUpper) ??
        (poleNumber ? poleByNumber.get(poleNumber) : undefined);

      if (!pole) {
        notFoundPoles.push(poleTokenRaw);
        continue;
      }

      for (const [colIndex, ramalType] of columnToRamalType.entries()) {
        const quantity = parseBulkRamalQuantity(row[colIndex]);
        if (quantity <= 0) {
          continue;
        }

        const current = appendByPoleId.get(pole.id) ?? [];
        current.push({
          id: nextId("RP"),
          quantity,
          ramalType,
        });
        appendByPoleId.set(pole.id, current);
        insertedRamais += quantity;
      }
    }

    if (appendByPoleId.size === 0) {
      setBulkRamalFeedback("Nenhum ramal valido foi encontrado para importar.");
      return null;
    }

    const nextTopology: BtTopology = {
      ...baseTopology,
      poles: baseTopology.poles.map((pole) => {
        const append = appendByPoleId.get(pole.id);
        if (!append || append.length === 0) {
          return pole;
        }
        return {
          ...pole,
          ramais: [...(pole.ramais ?? []), ...append],
        };
      }),
    };

    const notFoundSuffix =
      notFoundPoles.length > 0
        ? ` | postes nao encontrados: ${notFoundPoles.slice(0, 5).join(", ")}${notFoundPoles.length > 5 ? "..." : ""}`
        : "";

    return {
      nextTopology,
      feedback: `Importacao concluida: ${insertedRamais} ramal(is) em ${appendByPoleId.size} poste(s).${notFoundSuffix}`,
    };
  };

  const buildBulkRamaisForSinglePole = (
    rawInput: string,
    sourceTopology: BtTopology,
    poleId: string,
  ): { nextTopology: BtTopology; feedback: string } | null => {
    const result = buildTopologyWithBulkRamais(rawInput, sourceTopology);
    if (!result) {
      return null;
    }

    const requestedPoint = extractPointNumber(poleId);
    if (!requestedPoint) {
      return null;
    }

    const sourcePole = result.nextTopology.poles.find(
      (pole) => pole.id === poleId,
    );
    if (!sourcePole) {
      return null;
    }

    const nextTopology: BtTopology = {
      ...sourceTopology,
      poles: sourceTopology.poles.map((pole) => {
        if (pole.id !== poleId) {
          return pole;
        }
        const polePoint = extractPointNumber(pole.id);
        if (!polePoint || polePoint !== requestedPoint) {
          return pole;
        }
        return {
          ...pole,
          ramais: [...(pole.ramais ?? []), ...(sourcePole.ramais ?? [])],
        };
      }),
    };

    const insertedCount = (sourcePole.ramais ?? []).reduce(
      (sum, ramal) => sum + (ramal.quantity ?? 0),
      0,
    );

    return {
      nextTopology,
      feedback:
        insertedCount > 0
          ? `Ramal(is) aplicados ao ${poleId}: ${insertedCount}.`
          : `Nenhum ramal encontrado para o ${poleId} no arquivo importado.`,
    };
  };

  const mergeImportedPole = (
    currentTopology: BtTopology,
    importedTopology: BtTopology,
    poleId: string,
  ): BtTopology | null => {
    const importedPole = importedTopology.poles.find(
      (pole) => pole.id === poleId,
    );
    if (!importedPole) {
      return null;
    }

    const hasPole = currentTopology.poles.some((pole) => pole.id === poleId);
    const mergedPoles = hasPole
      ? currentTopology.poles.map((pole) =>
          pole.id === poleId
            ? {
                ...pole,
                title: importedPole.title,
                lat: importedPole.lat,
                lng: importedPole.lng,
              }
            : pole,
        )
      : [
          ...currentTopology.poles,
          { ...importedPole, ramais: importedPole.ramais ?? [] },
        ];

    const importedTransformers = importedTopology.transformers.filter(
      (transformer) => transformer.poleId === poleId,
    );

    const remainingTransformers = currentTopology.transformers.filter(
      (transformer) => transformer.poleId !== poleId,
    );

    return {
      ...currentTopology,
      poles: mergedPoles,
      transformers: [...remainingTransformers, ...importedTransformers],
    };
  };

  const applyReviewPoleBase = (
    baseTopology: BtTopology,
    review: BulkImportReviewState,
    poleId: string,
  ): BtTopology | null => {
    return mergeImportedPole(baseTopology, review.topologyFromWorkbook, poleId);
  };

  const applyReviewPoleRamais = (
    baseTopology: BtTopology,
    review: BulkImportReviewState,
    poleId: string,
  ): { nextTopology: BtTopology; feedback: string } | null => {
    return buildBulkRamaisForSinglePole(review.raw, baseTopology, poleId);
  };

  const stepToReviewPole = (
    review: BulkImportReviewState,
    nextPoleIndex: number,
    baseTopology: BtTopology,
  ) => {
    if (nextPoleIndex < 0 || nextPoleIndex >= review.orderedPoleIds.length) {
      setBulkRamalFeedback(
        `Revisão concluída: ${review.orderedPoleIds.length} poste(s) percorridos.`,
      );
      return;
    }

    const poleId = review.orderedPoleIds[nextPoleIndex];
    const withPole = applyReviewPoleBase(baseTopology, review, poleId);
    if (!withPole) {
      setBulkRamalFeedback(`Não foi possível preparar o poste ${poleId}.`);
      return;
    }

    onTopologyChange(withPole);
    focusPoleInMap(poleId);
    setBulkImportReview({ ...review, currentPoleIndex: nextPoleIndex });
    setBulkRamalFeedback(
      `Poste em revisão: ${poleId} (${nextPoleIndex + 1}/${review.orderedPoleIds.length}). Use Aplicar para ramais, Pular para ignorar ou Próximo para avançar.${review.workbookSettingsLabel}`,
    );
  };

  const handleReviewApplyCurrentPoleRamais = () => {
    if (!bulkImportReview) {
      return;
    }

    const poleId =
      bulkImportReview.orderedPoleIds[bulkImportReview.currentPoleIndex];
    const withPole = applyReviewPoleBase(btTopology, bulkImportReview, poleId);
    if (!withPole) {
      setBulkRamalFeedback(`Não foi possível aplicar o poste ${poleId}.`);
      return;
    }

    const ramaisResult = applyReviewPoleRamais(
      withPole,
      bulkImportReview,
      poleId,
    );
    if (ramaisResult) {
      onTopologyChange(ramaisResult.nextTopology);
      focusPoleInMap(poleId);
      setBulkRamalFeedback(
        `${ramaisResult.feedback} | Poste ${poleId} (${bulkImportReview.currentPoleIndex + 1}/${bulkImportReview.orderedPoleIds.length}).${bulkImportReview.workbookSettingsLabel}`,
      );
      return;
    }

    onTopologyChange(withPole);
    focusPoleInMap(poleId);
    setBulkRamalFeedback(
      `Poste ${poleId} aplicado, sem ramais encontrados no arquivo para este ponto.${bulkImportReview.workbookSettingsLabel}`,
    );
  };

  const handleReviewSkipCurrentPole = () => {
    if (!bulkImportReview) {
      return;
    }

    const nextIndex = bulkImportReview.currentPoleIndex + 1;
    if (nextIndex >= bulkImportReview.orderedPoleIds.length) {
      setBulkRamalFeedback(
        `Último poste já revisado. Revisão finalizada com ${bulkImportReview.orderedPoleIds.length} poste(s).`,
      );
      return;
    }

    stepToReviewPole(bulkImportReview, nextIndex, btTopology);
  };

  const handleReviewNextPole = () => {
    if (!bulkImportReview) {
      return;
    }

    const nextIndex = bulkImportReview.currentPoleIndex + 1;
    if (nextIndex >= bulkImportReview.orderedPoleIds.length) {
      setBulkRamalFeedback(
        `Último poste já revisado. Revisão finalizada com ${bulkImportReview.orderedPoleIds.length} poste(s).`,
      );
      return;
    }

    stepToReviewPole(bulkImportReview, nextIndex, btTopology);
  };

  const applyBulkRamalInsertFromRaw = (rawInput: string) => {
    const result = buildTopologyWithBulkRamais(rawInput, btTopology);
    if (!result) {
      return;
    }
    onTopologyChange(result.nextTopology);
    setBulkRamalFeedback(result.feedback);
  };

  const parseTrafoReadingsFromRamalSheet = (ramalSheet: any) => {
    // Workbook hint from user: RAMAL!AA15:AB30 has trafo readings.
    // Use first non-zero pair found: AA -> current(A), AB -> demand(kW).
    for (let row = 15; row <= 30; row += 1) {
      const aa = parseWorkbookNumber(ramalSheet[`AA${row}`]?.v);
      const ab = parseWorkbookNumber(ramalSheet[`AB${row}`]?.v);
      const hasAa = aa !== null && aa > 0;
      const hasAb = ab !== null && ab > 0;
      if (hasAa || hasAb) {
        return {
          currentMaxA: hasAa ? aa : null,
          demandKw: hasAb ? ab : null,
        };
      }
    }
    return { currentMaxA: null, demandKw: null };
  };

  const parseTopologyFromGeralSheet = (
    workbook: any,
    XLSX: any,
  ): BtTopology | null => {
    const geralName = workbook.SheetNames.find((name: string) =>
      normalizeHeaderKey(name).startsWith("GERAL"),
    );
    if (!geralName) {
      return null;
    }

    const sheet = workbook.Sheets[geralName];
    const ramalName = workbook.SheetNames.find(
      (name: string) => normalizeHeaderKey(name) === "RAMAL",
    );
    const ramalSheet = ramalName ? workbook.Sheets[ramalName] : null;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: true,
    }) as any[][];

    const headerRowIndex = rows.findIndex((row) => {
      const c0 = normalizeHeaderKey(String(row?.[0] ?? ""));
      const c1 = normalizeHeaderKey(String(row?.[1] ?? ""));
      return c0 === "PONTO" && c1 === "TRECHO";
    });

    if (headerRowIndex < 0) {
      return null;
    }

    const baseLat = btTopology.poles[0]?.lat ?? -22.9;
    const baseLng = btTopology.poles[0]?.lng ?? -43.2;
    const polesMap = new Map<string, BtPoleNode>();
    const edges: BtEdge[] = [];
    const transformers: BtTransformer[] = [];

    const demandFromO5 = parseWorkbookNumber(sheet["O5"]?.v);
    const projectPowerFromO3 = parseWorkbookNumber(sheet["O3"]?.v);
    const ramalTrafoReading = ramalSheet
      ? parseTrafoReadingsFromRamalSheet(ramalSheet)
      : { currentMaxA: null, demandKw: null };

    let syntheticIdx = 0;
    for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const point = parseWorkbookNumber(row[0]);
      if (!Number.isFinite(point) || point === null) {
        continue;
      }

      const pointId = `P${Math.trunc(point)}`;
      const x = parseWorkbookNumber(row[3]);
      const y = parseWorkbookNumber(row[4]);
      const couldBeLatLng =
        x !== null && y !== null && Math.abs(y) <= 90 && Math.abs(x) <= 180;
      const lat = couldBeLatLng
        ? (y as number)
        : baseLat + syntheticIdx * 0.00003;
      const lng = couldBeLatLng
        ? (x as number)
        : baseLng + syntheticIdx * 0.00003;
      syntheticIdx += 1;

      if (!polesMap.has(pointId)) {
        polesMap.set(pointId, {
          id: pointId,
          title: `Poste ${Math.trunc(point)}`,
          lat,
          lng,
          ramais: [],
        });
      }

      const trecho = parseWorkbookNumber(row[1]);
      const lado = normalizeHeaderKey(String(row[10] ?? ""));
      const conductorRaw = String(row[11] ?? "").trim();
      const conductorName =
        CONDUCTOR_NAMES.find(
          (name) =>
            normalizeHeaderKey(name) === normalizeHeaderKey(conductorRaw),
        ) ??
        (conductorRaw || CONDUCTOR_NAMES[0]);
      const cqtLengthMeters = parseWorkbookNumber(row[2]);

      if (trecho !== null && trecho > 0) {
        const parentId = `P${Math.trunc(trecho)}`;
        if (!polesMap.has(parentId)) {
          polesMap.set(parentId, {
            id: parentId,
            title: `Poste ${Math.trunc(trecho)}`,
            lat: baseLat + syntheticIdx * 0.00003,
            lng: baseLng + syntheticIdx * 0.00003,
            ramais: [],
          });
          syntheticIdx += 1;
        }

        edges.push({
          id: nextId("E"),
          fromPoleId: pointId,
          toPoleId: parentId,
          // C da aba GERAL representa taqueamento elétrico para CQT,
          // não geometria desenhada no mapa.
          cqtLengthMeters:
            cqtLengthMeters !== null && cqtLengthMeters > 0
              ? cqtLengthMeters
              : undefined,
          conductors: [
            {
              id: nextId("RC"),
              quantity: 1,
              conductorName,
            },
          ],
        });
      }

      // Source of truth for transformer pole is column K (LADO == TRAFO).
      if (lado === "TRAFO") {
        const pole = polesMap.get(pointId);
        if (pole && !transformers.some((t) => t.poleId === pointId)) {
          const demandKw = ramalTrafoReading.demandKw ?? demandFromO5 ?? 0;
          const projectPowerKva = projectPowerFromO3 ?? 0;
          const readings =
            ramalTrafoReading.currentMaxA !== null
              ? [
                  {
                    id: nextId("R"),
                    currentMaxA: ramalTrafoReading.currentMaxA,
                    temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
                    autoCalculated: false,
                  },
                ]
              : [];

          transformers.push({
            id: `TR${Math.trunc(point)}`,
            poleId: pointId,
            lat: pole.lat,
            lng: pole.lng,
            title: `Transformador TR${Math.trunc(point)}`,
            projectPowerKva,
            monthlyBillBrl: 0,
            demandKw,
            readings,
          });
        }
      }
    }

    if (polesMap.size === 0) {
      return null;
    }

    return {
      poles: [...polesMap.values()],
      edges,
      transformers,
    };
  };

  const applyBulkRamalInsert = () => {
    applyBulkRamalInsertFromRaw(bulkRamalText);
  };

  const importBulkRamaisFromWorkbook = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName =
        workbook.SheetNames.find(
          (name) => normalizeHeaderKey(name) === "RAMAL",
        ) ?? workbook.SheetNames[0];

      if (!sheetName) {
        setBulkRamalFeedback("Planilha sem abas legiveis.");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_csv(sheet, {
        FS: "\t",
        blankrows: false,
      });

      if (!raw.trim()) {
        setBulkRamalFeedback(`A aba ${sheetName} esta vazia.`);
        return;
      }

      setBulkRamalText(raw);
      const workbookProjectSettings = parseWorkbookProjectSettings(workbook);
      if (workbookProjectSettings) {
        onProjectTypeChange?.(workbookProjectSettings.projectType);
        onClandestinoAreaChange?.(workbookProjectSettings.clandestinoAreaM2);
      }

      const workbookSettingsLabel = workbookProjectSettings
        ? workbookProjectSettings.projectType === "clandestino"
          ? ` | Calculo: CLANDESTINO (GERAL!I2=${workbookProjectSettings.geralI2Raw}; area GERAL!L2=${workbookProjectSettings.clandestinoAreaM2} m2).`
          : ` | Calculo: NORMAL (GERAL!I2=${workbookProjectSettings.geralI2Raw}; area GERAL!L2=${workbookProjectSettings.clandestinoAreaM2} m2).`
        : "";

      const topologyFromWorkbook = parseTopologyFromGeralSheet(workbook, XLSX);
      if (topologyFromWorkbook) {
        const orderedPoles = [...topologyFromWorkbook.poles].sort((a, b) => {
          const na = Number(a.id.replace(/^P/, ""));
          const nb = Number(b.id.replace(/^P/, ""));
          if (Number.isFinite(na) && Number.isFinite(nb)) {
            return na - nb;
          }
          return a.id.localeCompare(b.id);
        });

        const firstPole = orderedPoles[0] ?? null;
        if (!firstPole) {
          setBulkRamalFeedback("Topologia da aba GERAL sem postes válidos.");
          return;
        }

        const reviewState: BulkImportReviewState = {
          raw,
          topologyFromWorkbook,
          orderedPoleIds: orderedPoles.map((pole) => pole.id),
          currentPoleIndex: 0,
          workbookSettingsLabel,
        };
        setBulkImportReview(reviewState);

        const firstPoleTopology = mergeImportedPole(
          btTopology,
          topologyFromWorkbook,
          firstPole.id,
        );
        if (!firstPoleTopology) {
          setBulkRamalFeedback("Falha ao aplicar primeiro poste importado.");
          return;
        }

        onTopologyChange(firstPoleTopology);
        focusPoleInMap(firstPole.id);

        const applyFirstPoleRamais = () => {
          const singlePoleResult = buildBulkRamaisForSinglePole(
            raw,
            firstPoleTopology,
            firstPole.id,
          );
          if (singlePoleResult) {
            onTopologyChange(singlePoleResult.nextTopology);
            setBulkRamalFeedback(
              `${singlePoleResult.feedback} | Poste em revisão: ${firstPole.id} (1/${reviewState.orderedPoleIds.length}). Use Próximo para seguir poste a poste.${workbookSettingsLabel}`,
            );
            return;
          }

          setBulkRamalFeedback(
            `Poste em revisão: ${firstPole.id} (1/${reviewState.orderedPoleIds.length}). Não foi possível aplicar ramais por ponto.${workbookSettingsLabel}`,
          );
        };

        const skipFirstPoleRamais = () => {
          setBulkRamalFeedback(
            `Poste em revisão: ${firstPole.id} (1/${reviewState.orderedPoleIds.length}). Ramais não aplicados para este ponto (pendente). Use Aplicar/Pular/Próximo.${workbookSettingsLabel}`,
          );
        };

        if (onRequestCriticalConfirmation) {
          onRequestCriticalConfirmation({
            title: "Aplicar ramais no primeiro poste?",
            message: `Primeiro poste aplicado: ${firstPole.id}.\n\nDeseja aplicar agora os ramais deste ponto usando o número do ponto no arquivo importado?`,
            confirmLabel: "Aplicar agora",
            cancelLabel: "Fazer depois",
            tone: "warning",
            onConfirm: applyFirstPoleRamais,
            onCancel: skipFirstPoleRamais,
          });
        } else {
          skipFirstPoleRamais();
        }
      } else {
        setBulkImportReview(null);
        applyBulkRamalInsertFromRaw(raw);
        if (workbookSettingsLabel) {
          setBulkRamalFeedback((prev) => `${prev}${workbookSettingsLabel}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "erro desconhecido";
      setBulkRamalFeedback(`Falha ao ler planilha Excel: ${message}`);
    }
  };
  const selectedEdgeLengthLabel =
    typeof (selectedEdge?.cqtLengthMeters ?? selectedEdge?.lengthMeters) ===
    "number"
      ? `${Number(selectedEdge?.cqtLengthMeters ?? selectedEdge?.lengthMeters).toFixed(2)} m`
      : "-";
  const totalNetworkLengthLabel = `${Math.round(summary.totalLengthMeters)} m`;

  const verifiedPoles = btTopology.poles.filter((pole) => pole.verified).length;
  const verifiedEdges = btTopology.edges.filter((edge) => edge.verified).length;
  const verifiedTransformers = btTopology.transformers.filter(
    (transformer) => transformer.verified,
  ).length;

  const updatePoleVerified = (poleId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? { ...pole, verified } : pole,
      ),
    });
  };

  const updatePoleRamais = (poleId: string, ramais: BtPoleRamalEntry[]) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? { ...pole, ramais } : pole,
      ),
    });
  };

  const updateTransformerVerified = (
    transformerId: string,
    verified: boolean,
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId
          ? { ...transformer, verified }
          : transformer,
      ),
    });
  };

  const updateEdgeVerified = (edgeId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, verified } : edge,
      ),
    });
  };

  const updateEdgeCqtLengthMeters = (edgeId: string, lengthMeters: number) => {
    const sanitized = Number.isFinite(lengthMeters)
      ? Math.max(0, Number(lengthMeters.toFixed(2)))
      : 0;

    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, cqtLengthMeters: sanitized } : edge,
      ),
    });
  };

  const updateTransformerReadings = (
    transformerId: string,
    readings: BtTransformerReading[],
  ) => {
    // Compute demandKw and monthlyBillBrl inline using physical constants from btPhysicalConstants.
    // The backend will recompute these in the next /api/bt/derived call for authoritative values.
    const monthlyBillBrl = readings.reduce(
      (acc, r) => acc + ((r as { billedBrl?: number }).billedBrl ?? 0),
      0,
    );
    const correctedDemands = readings.map((r) => {
      const currentMaxA = (r as { currentMaxA?: number }).currentMaxA ?? 0;
      const temperatureFactor =
        (r as { temperatureFactor?: number }).temperatureFactor ?? 1;
      return currentMaxA * CURRENT_TO_DEMAND_CONVERSION * temperatureFactor;
    });
    const demandKw = Number(Math.max(...correctedDemands, 0).toFixed(2));

    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) => {
        if (transformer.id !== transformerId) {
          return transformer;
        }

        return {
          ...transformer,
          readings,
          monthlyBillBrl,
          demandKw,
        };
      }),
    });
  };

  const updateTransformerProjectPower = (
    transformerId: string,
    projectPowerKva: number,
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId
          ? { ...transformer, projectPowerKva }
          : transformer,
      ),
    });
  };

  const handleEditablePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || target.type !== "number") {
      return;
    }

    const rawText = e.clipboardData.getData("text");
    const normalized = normalizeNumericClipboardText(rawText);
    if (!normalized) {
      return;
    }

    e.preventDefault();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = `${target.value.slice(0, start)}${normalized}${target.value.slice(end)}`;
    target.value = nextValue;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const updateEdgeConductors = (
    edgeId: string,
    conductors: BtTopology["edges"][number]["conductors"],
  ) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          conductors,
        };
      }),
    });
  };

  const updateEdgeReplacementFromConductors = (
    edgeId: string,
    replacementFromConductors: BtTopology["edges"][number]["conductors"],
  ) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          replacementFromConductors,
        };
      }),
    });
  };

  const clandestinoDemandKw =
    projectType === "clandestino" ? clandestinoDisplay.demandKw : 0;
  const clandestinoAreaRange = {
    min: clandestinoDisplay.areaMin,
    max: clandestinoDisplay.areaMax,
  };
  const clandestinoDemandKva =
    projectType === "clandestino" ? clandestinoDisplay.demandKva : null;
  const clandestinoDiversificationFactor =
    projectType === "clandestino"
      ? clandestinoDisplay.diversificationFactor
      : null;
  const clandestinoFinalDemandKva =
    projectType === "clandestino" ? clandestinoDisplay.finalDemandKva : 0;
  const isNormalProject = projectType !== "clandestino";
  const transformersWithReadings = btTopology.transformers.filter(
    (transformer) => transformer.readings.length > 0,
  ).length;
  const transformersWithoutReadings = Math.max(
    0,
    btTopology.transformers.length - transformersWithReadings,
  );
  const pointDemandCardClass =
    projectType === "clandestino"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : btTopology.transformers.length === 0 || transformersWithReadings === 0
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : transformersWithoutReadings > 0
          ? "border-yellow-300 bg-yellow-50 text-yellow-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900";
  const pointDemandStatus = !isNormalProject
    ? null
    : btTopology.transformers.length === 0
      ? "Sem transformador cadastrado. A demanda ficará zerada até inserir ao menos 1 trafo."
      : transformersWithReadings === 0
        ? "Sem leituras de trafo. Preencha as leituras para calcular a demanda por ponto."
        : transformersWithoutReadings > 0
          ? `Demanda parcial: ${transformersWithReadings}/${btTopology.transformers.length} trafo(s) com leituras.`
          : "Demanda consolidada com leituras em todos os trafos.";
  const poleTitleById = new Map(
    btTopology.poles.map((pole) => [pole.id, pole.title || pole.id]),
  );
  const clientDemandByPole = [...accumulatedByPole].sort(
    (a, b) => b.localTrechoDemandKva - a.localTrechoDemandKva,
  );

  return (
    <div
      className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"
      onPasteCapture={handleEditablePaste}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <Activity size={16} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">
            Topologia BT
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase">
          {projectType} / {btNetworkScenario === "asis" ? "ATUAL" : "PROJETO"}
        </span>
      </div>

      <div
        className={`rounded-lg border p-2 text-[10px] ${btNetworkScenario === "asis" ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-indigo-300 bg-indigo-50 text-indigo-900"}`}
      >
        {btNetworkScenario === "asis"
          ? "Cenário REDE ATUAL: painel voltado para leitura, conferência e cálculo sobre rede existente."
          : "Cenário REDE NOVA: painel voltado para projeto, lançamento e dimensionamento da nova topologia."}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-[10px] text-slate-700">
        <div className="font-semibold uppercase tracking-wide text-slate-800">
          Fluxo de Lançamento BT
        </div>
        <div>
          0. Defina se o projeto é Normal ou Clandestino (m² obrigatório no
          clandestino).
        </div>
        <div>
          1. Informe a localização dos postes (ponto no mapa ou coordenadas).
        </div>
        <div>
          2/3. Trace os condutores e marque os postes com trafo (ordem livre).
        </div>
        <div>4. Informe os ramais (clientes) em cada poste.</div>
      </div>

      <div className="space-y-2 rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-[10px] text-cyan-900">
        <div className="font-semibold uppercase tracking-wide">
          Passo 0 · Tipo de Projeto
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-cyan-900">
              Modo de cálculo
            </label>
            <select
              value={projectType === "clandestino" ? "clandestino" : "ramais"}
              onChange={(e) =>
                onProjectTypeChange?.(
                  e.target.value as "ramais" | "clandestino",
                )
              }
              title="Modo de cálculo do projeto BT"
              className="w-full rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
            >
              <option value="ramais">Normal</option>
              <option value="clandestino">Clandestino</option>
            </select>
          </div>
          {projectType === "clandestino" && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-cyan-900">
                Área (m²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={clandestinoAreaM2}
                title="Área de clandestinos em metros quadrados"
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) =>
                  onClandestinoAreaChange?.(
                    Math.max(0, Math.round(numberFromInput(e.target.value))),
                  )
                }
                className="w-28 rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
              />
            </div>
          )}
        </div>
        {projectType !== "clandestino" && (
          <div className="rounded border border-cyan-300 bg-white p-2 text-[10px] text-slate-700">
            <div className="mb-1 font-semibold text-cyan-900">
              Entrada rapida de ramais
            </div>
            <div className="mb-2 text-[10px] text-slate-600">
              Cole tabela do Excel (N do Poste + colunas de tipos) para insercao
              em lote.
            </div>
            <button
              onClick={() => {
                setBulkRamalFeedback("");
                setIsBulkRamalModalOpen(true);
              }}
              className="rounded border border-cyan-300 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
            >
              Inserir bruto de ramais
            </button>
          </div>
        )}
      </div>

      {isBulkRamalModalOpen && (
        <div className="fixed inset-0 z-[980] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-300 bg-white p-4 shadow-2xl">
            <div className="text-sm font-semibold text-slate-800">
              Insercao bruta de ramais
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Formato esperado: tabela colada do Excel com primeira coluna "N do
              Poste" e colunas de tipos de ramal (ex.: 13 DX 6 AWG, 70 MMX, 185
              MMX).
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsBulkDropActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsBulkDropActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsBulkDropActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsBulkDropActive(false);
                const file = e.dataTransfer.files?.[0];
                if (!file) {
                  return;
                }
                void importBulkRamaisFromWorkbook(file);
              }}
              className={`mt-3 rounded border-2 border-dashed p-3 text-center text-xs ${isBulkDropActive ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-300 bg-slate-50 text-slate-600"}`}
            >
              Arraste e solte a planilha (.xlsx/.xlsm) para ler a aba RAMAL
              automaticamente.
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  Selecionar arquivo
                </button>
              </div>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importBulkRamaisFromWorkbook(file);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <textarea
              value={bulkRamalText}
              onChange={(e) => setBulkRamalText(e.target.value)}
              placeholder="Cole aqui a tabela"
              className="mt-3 h-56 w-full rounded border border-slate-300 bg-white p-2 text-[11px] text-slate-800"
            />

            {bulkRamalFeedback && (
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700">
                {bulkRamalFeedback}
              </div>
            )}

            {bulkImportReview && (
              <div className="mt-2 rounded border border-cyan-200 bg-cyan-50 p-2 text-[10px] text-cyan-900">
                <div className="font-semibold">
                  Revisão sequencial ativa: poste{" "}
                  {bulkImportReview.currentPoleIndex + 1}/
                  {bulkImportReview.orderedPoleIds.length}
                </div>
                <div className="mt-1">
                  Poste atual:{" "}
                  {
                    bulkImportReview.orderedPoleIds[
                      bulkImportReview.currentPoleIndex
                    ]
                  }
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReviewApplyCurrentPoleRamais}
                    className="rounded border border-emerald-500 bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={handleReviewSkipCurrentPole}
                    className="rounded border border-amber-400 bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-400"
                  >
                    Pular
                  </button>
                  <button
                    type="button"
                    onClick={handleReviewNextPole}
                    className="rounded border border-cyan-400 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsBulkRamalModalOpen(false);
                  setBulkImportReview(null);
                }}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                onClick={applyBulkRamalInsert}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Postes: {summary.poles}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Condutores: {summary.edges}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Trafos: {summary.transformers}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Rede: {Math.round(summary.totalLengthMeters)} m
        </div>
      </div>

      {btNetworkScenario === "asis" && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Postes verificados: {verifiedPoles}/{summary.poles}
          </div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Condutores verificados: {verifiedEdges}/{summary.edges}
          </div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Trafos verificados: {verifiedTransformers}/{summary.transformers}
          </div>
        </div>
      )}

      <div
        className={`rounded-lg border p-2 text-[10px] ${pointDemandCardClass}`}
      >
        {projectType === "clandestino"
          ? `Demanda por ponto (regra clandestino): ${pointDemandKva.toFixed(2)} kVA`
          : `Demanda por ponto (leituras de trafo): ${pointDemandKva.toFixed(2)} kVA`}
        {pointDemandStatus && <div className="mt-1">{pointDemandStatus}</div>}
      </div>

      {clientDemandByPole.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-slate-50 p-2 text-[10px] text-slate-700">
          <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-800">
            Ranking Demanda de Clientes (Top 5)
          </div>
          {clientDemandByPole.slice(0, 5).map((item) => (
            <div
              key={item.poleId}
              className="flex items-center justify-between border-b border-cyan-200 py-0.5 last:border-b-0"
            >
              <span>{poleTitleById.get(item.poleId) ?? item.poleId}</span>
              <span className="flex items-center gap-1">
                CLT {item.localClients} | {item.localTrechoDemandKva.toFixed(2)}{" "}
                kVA
                {(typeof item.voltageV === "number" ||
                  typeof item.dvAccumPercent === "number") && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold ${item.cqtStatus === "CRÍTICO" ? "bg-red-100 text-red-700" : item.cqtStatus === "ATENÇÃO" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                    title="Indicador CQT no ponto"
                  >
                    {typeof item.voltageV === "number"
                      ? `${item.voltageV.toFixed(1)}V`
                      : "-"}{" "}
                    /{" "}
                    {typeof item.dvAccumPercent === "number"
                      ? `${item.dvAccumPercent.toFixed(2)}%`
                      : "-"}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {projectType === "clandestino" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
          {clandestinoDemandKva === null
            ? `Área clandestina inválida (${clandestinoAreaM2} m²). Faixa da planilha: ${clandestinoAreaRange.min}-${clandestinoAreaRange.max} m² (inteiros).`
            : `Carga base clandestinos (${clandestinoAreaM2} m²): ${clandestinoDemandKw.toFixed(2)} kVA`}
          {clandestinoDemandKva !== null && (
            <div className="mt-1 text-amber-900">
              Clientes:{" "}
              {btTopology.poles.reduce(
                (acc, p) =>
                  acc +
                  (p.ramais?.reduce((rAcc, r) => rAcc + r.quantity, 0) ?? 0),
                0,
              )}{" "}
              | Fator:{" "}
              {clandestinoDiversificationFactor?.toFixed(2) ?? "inválido"} |
              Demanda final: {clandestinoFinalDemandKva.toFixed(2)} kVA
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-cyan-200 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-800">
          Postes / Verificação
        </div>

        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Poste selecionado</div>
          {btTopology.poles.length === 0 ? (
            <div className="text-[10px] text-slate-500">
              Nenhum poste cadastrado.
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPole?.title ?? ""}
                  spellCheck={false}
                  onChange={(e) => {
                    if (!selectedPole) {
                      return;
                    }

                    const nextTitle = e.target.value;
                    const selectedOtherPole = btTopology.poles.find(
                      (pole) =>
                        pole.id !== selectedPole.id && pole.title === nextTitle,
                    );
                    if (selectedOtherPole) {
                      selectPole(selectedOtherPole.id);
                      return;
                    }

                    onBtRenamePole?.(selectedPole.id, nextTitle);
                  }}
                  title="Nome/seleção do poste"
                  className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800 focus:border-cyan-500/60 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsPoleDropdownOpen((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  title="Selecionar poste"
                >
                  <ChevronDown size={14} />
                </button>
                {isPoleDropdownOpen && (
                  <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                    {btTopology.poles.map((pole) => (
                      <button
                        key={pole.id}
                        type="button"
                        onClick={() => selectPole(pole.id)}
                        className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedPoleId === pole.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
                      >
                        {pole.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPole && (
                <>
                  <button
                    onClick={() =>
                      updatePoleVerified(
                        selectedPole.id,
                        !selectedPole.verified,
                      )
                    }
                    className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
                  >
                    {selectedPole.verified
                      ? "Marcar como não verificado"
                      : "Marcar poste como verificado"}
                  </button>

                  {onBtSetPoleChangeFlag && (
                    <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                      <button
                        onClick={() =>
                          onBtSetPoleChangeFlag(selectedPole.id, "remove")
                        }
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "remove" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"}`}
                      >
                        Remoção
                      </button>
                      <button
                        onClick={() =>
                          onBtSetPoleChangeFlag(selectedPole.id, "new")
                        }
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "new" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}
                      >
                        Novo
                      </button>
                      <button
                        onClick={() =>
                          onBtSetPoleChangeFlag(selectedPole.id, "replace")
                        }
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "replace" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-slate-300 bg-white text-slate-700"}`}
                      >
                        Substituição
                      </button>
                      <button
                        onClick={() =>
                          onBtTogglePoleCircuitBreak?.(
                            selectedPole.id,
                            !(selectedPole.circuitBreakPoint ?? false),
                          )
                        }
                        title="Separa fisicamente o circuito neste poste"
                        className={`rounded border px-2 py-1 text-[10px] font-mono tracking-tight ${(selectedPole.circuitBreakPoint ?? false) ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-300 bg-white text-slate-700"}`}
                      >
                        -| |-
                      </button>
                      <button
                        onClick={() =>
                          onBtSetPoleChangeFlag(selectedPole.id, "existing")
                        }
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "existing" ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700" : "border-slate-300 bg-white text-slate-700"}`}
                      >
                        Existente
                      </button>
                    </div>
                  )}

                  {(selectedPole.circuitBreakPoint ?? false) && (
                    <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
                      Separacao fisica ativa: o circuito do trafo para neste
                      poste.
                    </div>
                  )}

                  <div className="rounded border border-slate-300 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
                      <span>Ramais do poste</span>
                      <button
                        onClick={() => {
                          const defaultRamalType =
                            projectType === "clandestino"
                              ? CLANDESTINO_RAMAL_TYPE
                              : NORMAL_CLIENT_RAMAL_TYPES[0];
                          updatePoleRamais(selectedPole.id, [
                            ...(selectedPole.ramais ?? []),
                            {
                              id: nextId("RP"),
                              quantity: 1,
                              ramalType: defaultRamalType,
                            },
                          ]);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Plus size={12} /> Ramal
                      </button>
                    </div>

                    {(selectedPole.ramais ?? []).length === 0 ? (
                      <div className="text-[10px] text-slate-500">
                        Sem ramais cadastrados neste poste.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="rounded border border-slate-200 bg-slate-50 p-1.5 text-[10px] text-slate-600">
                          {(selectedPole.ramais ?? []).map((ramal) => {
                            const ramalType =
                              ramal.ramalType ??
                              (projectType === "clandestino"
                                ? CLANDESTINO_RAMAL_TYPE
                                : NORMAL_CLIENT_RAMAL_TYPES[0]);
                            return (
                              <div key={`summary-${ramal.id}`}>
                                {ramal.quantity} x {ramalType}
                              </div>
                            );
                          })}
                        </div>
                        {(selectedPole.ramais ?? []).map((ramal) => (
                          <div
                            key={ramal.id}
                            className="grid grid-cols-[84px_1fr_auto] gap-2"
                          >
                            <input
                              type="number"
                              min={1}
                              value={ramal.quantity}
                              title={`Quantidade do ramal ${ramal.id}`}
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const quantity = Math.max(
                                  1,
                                  numberFromInput(e.target.value),
                                );
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) =>
                                    item.id === ramal.id
                                      ? { ...item, quantity }
                                      : item,
                                  ),
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            />
                            <select
                              value={
                                ramal.ramalType ??
                                (projectType === "clandestino"
                                  ? CLANDESTINO_RAMAL_TYPE
                                  : NORMAL_CLIENT_RAMAL_TYPES[0])
                              }
                              title={`Tipo do ramal ${ramal.id}`}
                              onChange={(e) => {
                                const ramalType = e.target.value;
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) =>
                                    item.id === ramal.id
                                      ? { ...item, ramalType }
                                      : item,
                                  ),
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            >
                              {(projectType === "clandestino"
                                ? [CLANDESTINO_RAMAL_TYPE]
                                : NORMAL_CLIENT_RAMAL_TYPES
                              ).map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).filter(
                                    (item) => item.id !== ramal.id,
                                  ),
                                );
                              }}
                              className="rounded border border-rose-300 p-1.5 text-rose-700 hover:bg-rose-50"
                              title="Remover ramal"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Transformador (
          {btNetworkScenario === "asis"
            ? "leituras da rede atual"
            : "base de projeto"}
          )
        </div>
        {btTopology.transformers.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === "asis"
              ? "Sem transformador identificado para conferência de leituras da rede existente."
              : "Insira um transformador no mapa para montar a nova topologia BT."}
          </div>
        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                value={selectedTransformer?.title ?? ""}
                spellCheck={false}
                onChange={(e) => {
                  if (!selectedTransformer) {
                    return;
                  }

                  const nextTitle = e.target.value;
                  const selectedOtherTransformer = btTopology.transformers.find(
                    (transformer) =>
                      transformer.id !== selectedTransformer.id &&
                      transformer.title === nextTitle,
                  );
                  if (selectedOtherTransformer) {
                    selectTransformer(selectedOtherTransformer.id);
                    return;
                  }

                  onBtRenameTransformer?.(selectedTransformer.id, nextTitle);
                }}
                title="Nome/seleção do transformador"
                className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800"
              />
              <button
                type="button"
                onClick={() =>
                  setIsTransformerDropdownOpen((current) => !current)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                title="Selecionar transformador"
              >
                <ChevronDown size={14} />
              </button>
              {isTransformerDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {btTopology.transformers.map((transformer) => (
                    <button
                      key={transformer.id}
                      type="button"
                      onClick={() => selectTransformer(transformer.id)}
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedTransformerId === transformer.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
                    >
                      {transformer.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTransformer && (
              <button
                onClick={() =>
                  updateTransformerVerified(
                    selectedTransformer.id,
                    !selectedTransformer.verified,
                  )
                }
                className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
              >
                {selectedTransformer.verified
                  ? "Marcar trafo como não verificado"
                  : "Marcar trafo como verificado"}
              </button>
            )}

            {selectedTransformer && onBtSetTransformerChangeFlag && (
              <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "remove",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "remove" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Remoção
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(selectedTransformer.id, "new")
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "new" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Novo
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "replace",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "replace" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Substituição
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "existing",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "existing" ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Existente
                </button>
              </div>
            )}

            {selectedTransformer && (
              <div className="space-y-2">
                {(() => {
                  const transformerDebug =
                    transformerDebugById[selectedTransformer.id];
                  const baseReading = selectedTransformer.readings[0] ?? {
                    id: nextId("R"),
                    currentMaxA: 0,
                    temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
                    autoCalculated: false,
                  };
                  const currentMaxA = baseReading.currentMaxA ?? 0;
                  const temperatureFactor =
                    baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR;
                  const hasReadings = selectedTransformer.readings.length > 0;
                  const demandMaxKw =
                    currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
                  const correctedDemandKw = demandMaxKw * temperatureFactor;
                  const effectiveDemandKw = hasReadings
                    ? correctedDemandKw
                    : (selectedTransformer.demandKw ?? 0);
                  const projectPowerKva =
                    selectedTransformer.projectPowerKva ?? 0;
                  const loadingPct =
                    projectPowerKva > 0
                      ? (effectiveDemandKw / projectPowerKva) * 100
                      : null;
                  const totalClients = btTopology.poles.reduce(
                    (acc, pole) =>
                      acc +
                      (pole.ramais ?? []).reduce(
                        (sum, ramal) => sum + ramal.quantity,
                        0,
                      ),
                    0,
                  );
                  // pointDemandKva from backend is the DMDI (demanda média por cliente).
                  const dmdi = pointDemandKva;

                  return (
                    <>
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-[10px] text-slate-500">
                            Corrente maxima (A)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Demanda corrigida (kVA)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Fator temperatura
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Trafo proj (kVA)
                          </div>
                          <NumericTextInput
                            value={currentMaxA}
                            title="Corrente máxima do transformador em ampères"
                            placeholder="Corrente máxima"
                            onChange={(next) => {
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    currentMaxA: next,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={effectiveDemandKw}
                            title="Demanda corrigida do transformador em kVA"
                            placeholder="Demanda corrigida"
                            onChange={(nextCorrectedDemandKva) => {
                              if (!hasReadings) {
                                return;
                              }

                              const temperatureBase =
                                temperatureFactor > 0
                                  ? temperatureFactor
                                  : DEFAULT_TEMPERATURE_FACTOR;
                              const inferredCurrent =
                                Math.round(
                                  (nextCorrectedDemandKva /
                                    (CURRENT_TO_DEMAND_CONVERSION *
                                      temperatureBase)) *
                                    100,
                                ) / 100;
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    currentMaxA: inferredCurrent,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={temperatureFactor}
                            title="Fator de temperatura do transformador"
                            placeholder="Fator de temperatura"
                            onChange={(next) => {
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    temperatureFactor: next,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={projectPowerKva}
                            title="Potência de projeto do transformador em kVA"
                            placeholder="Potência de projeto"
                            onChange={(next) =>
                              updateTransformerProjectPower(
                                selectedTransformer.id,
                                next,
                              )
                            }
                            className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const estimatedDemandKw =
                            transformerDebug?.estimatedDemandKw;
                          const fallbackDemandKw =
                            selectedTransformer.demandKw ?? 0;
                          const demandTargetKw =
                            Number.isFinite(estimatedDemandKw) &&
                            typeof estimatedDemandKw === "number" &&
                            estimatedDemandKw > 0
                              ? estimatedDemandKw
                              : fallbackDemandKw;
                          const temperatureBase =
                            temperatureFactor > 0
                              ? temperatureFactor
                              : DEFAULT_TEMPERATURE_FACTOR;
                          const inferredCurrent =
                            temperatureBase > 0
                              ? Math.round(
                                  (demandTargetKw /
                                    (CURRENT_TO_DEMAND_CONVERSION *
                                      temperatureBase)) *
                                    100,
                                ) / 100
                              : 0;

                          updateTransformerReadings(selectedTransformer.id, [
                            {
                              ...baseReading,
                              currentMaxA: inferredCurrent,
                              temperatureFactor: temperatureBase,
                              autoCalculated: true,
                            },
                          ]);
                        }}
                        className="w-full rounded border border-blue-400 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        Recalcular corrente maxima automaticamente
                      </button>

                      <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700 space-y-1">
                        <div>
                          Demanda corrigida: {formatBr(effectiveDemandKw)} kVA
                        </div>
                        <div>
                          Demanda maxima:{" "}
                          {formatBr(
                            hasReadings ? demandMaxKw : effectiveDemandKw,
                          )}{" "}
                          kVA
                        </div>
                        <div>
                          Carregamento atual:{" "}
                          {loadingPct === null
                            ? "#DIV/0!"
                            : `${loadingPct.toFixed(2)}%`}
                        </div>
                        <div>
                          DMDI (ramal):{" "}
                          {totalClients === 0 ? "#DIV/0!" : dmdi.toFixed(2)}
                        </div>
                        <div>Total clientes: {totalClients}</div>
                      </div>

                      {transformerDebug && (
                        <div className="rounded border border-indigo-300 bg-indigo-50 p-2 text-[10px] text-indigo-900 space-y-1">
                          <div className="font-semibold uppercase tracking-wide">
                            Atribuicao automatica
                          </div>
                          <div>
                            Clientes atribuidos ao trafo:{" "}
                            {transformerDebug.assignedClients}
                          </div>
                          <div>
                            Demanda estimada automatica:{" "}
                            {formatBr(transformerDebug.estimatedDemandKw)} kVA
                          </div>
                          <div>
                            Fonte: particao eletrica da rede considerando
                            seccionamentos BT.
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Condutor
        </div>
        {btTopology.edges.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === "asis"
              ? "Sem condutores cadastrados para representar os ramais existentes."
              : "Insira condutores no mapa para lançar os ramais da rede nova."}
          </div>
        ) : (
          <>
            <select
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-800"
              value={selectedEdgeId}
              title="Selecionar trecho BT"
              onChange={(e) => selectEdge(e.target.value)}
            >
              {btTopology.edges.map((edge) => {
                const fromTitle =
                  btTopology.poles.find((pole) => pole.id === edge.fromPoleId)
                    ?.title ?? edge.fromPoleId;
                const toTitle =
                  btTopology.poles.find((pole) => pole.id === edge.toPoleId)
                    ?.title ?? edge.toPoleId;
                return (
                  <option key={edge.id} value={edge.id}>
                    {edge.id} ({fromTitle}
                    {" <-> "}
                    {toTitle})
                  </option>
                );
              })}
            </select>

            {selectedEdge && (
              <div className="space-y-2">
                {(() => {
                  const selectedEdgeFlag = getEdgeChangeFlag(selectedEdge);
                  return (
                    <div className="rounded border border-slate-200 bg-slate-100/70 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Condutores do trecho
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        Preset padrão para novos trechos:{" "}
                        <span className="font-semibold text-fuchsia-700">
                          Existente (Magenta)
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            const deleteSelectedEdge = () => {
                              onTopologyChange({
                                ...btTopology,
                                edges: btTopology.edges.filter(
                                  (edge) => edge.id !== selectedEdge.id,
                                ),
                              });
                            };

                            if (onRequestCriticalConfirmation) {
                              onRequestCriticalConfirmation({
                                title: "Apagar trecho BT?",
                                message: `Apagar o trecho ${selectedEdge.id}? Esta ação não pode ser desfeita.`,
                                confirmLabel: "Apagar trecho",
                                tone: "danger",
                                onConfirm: deleteSelectedEdge,
                              });
                              return;
                            }

                            deleteSelectedEdge();
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded border border-rose-500/40 px-2 text-xs text-rose-600 hover:bg-rose-50"
                          title="Apagar trecho selecionado"
                        >
                          <Trash2 size={12} /> Trecho
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "remove")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "remove"
                              ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de remoção"
                        >
                          Remoção
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "new")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "new"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de novo"
                        >
                          Novo
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "replace")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "replace"
                              ? "border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de substituição"
                        >
                          Substituição
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "existing")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "existing"
                              ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Preset existente"
                        >
                          Existente
                        </button>
                        <button
                          onClick={() =>
                            updateEdgeVerified(
                              selectedEdge.id,
                              !selectedEdge.verified,
                            )
                          }
                          className="inline-flex h-8 items-center rounded border border-cyan-400 bg-white px-2 text-xs text-cyan-900 hover:bg-cyan-100"
                        >
                          {selectedEdge.verified
                            ? "Condutor verificado"
                            : "Marcar verificado"}
                        </button>
                        <button
                          onClick={() => {
                            updateEdgeConductors(selectedEdge.id, [
                              ...selectedEdge.conductors,
                              {
                                id: nextId("C"),
                                quantity: 1,
                                conductorName: CONDUCTOR_NAMES[0],
                              },
                            ]);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Plus size={12} />{" "}
                          {selectedEdgeFlag === "replace"
                            ? "Condutor que entra"
                            : "Condutor"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {getEdgeChangeFlag(selectedEdge) === "replace" && (
                  <div className="rounded border border-cyan-300 bg-cyan-50 p-2 text-[10px] text-cyan-900">
                    <div className="font-semibold uppercase tracking-wide">
                      Condutor que entra
                    </div>
                    <div className="mt-1">
                      Este bloco define o novo condutor que ficará no trecho
                      após a substituição.
                    </div>
                  </div>
                )}

                {selectedEdge.conductors.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2"
                  >
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      title={`Quantidade do condutor ${entry.id}`}
                      onChange={(e) => {
                        const quantity = Math.max(
                          1,
                          numberFromInput(e.target.value),
                        );
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) =>
                            item.id === entry.id ? { ...item, quantity } : item,
                          ),
                        );
                      }}
                      className="w-full min-w-0 rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    />
                    <select
                      value={entry.conductorName}
                      title={`Tipo do condutor ${entry.id}`}
                      onChange={(e) => {
                        const conductorName = e.target.value;
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) =>
                            item.id === entry.id
                              ? { ...item, conductorName }
                              : item,
                          ),
                        );
                      }}
                      className="min-w-0 w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    >
                      {CONDUCTOR_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.filter(
                            (item) => item.id !== entry.id,
                          ),
                        );
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      title="Remover condutor"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {getEdgeChangeFlag(selectedEdge) === "replace" && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Condutor que sai
                    </div>
                    {(selectedEdge.replacementFromConductors ?? []).length ===
                      0 && (
                      <button
                        onClick={() => {
                          updateEdgeReplacementFromConductors(selectedEdge.id, [
                            {
                              id: nextId("RC"),
                              quantity: 1,
                              conductorName: CONDUCTOR_NAMES[0],
                            },
                          ]);
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded border border-amber-400 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100"
                      >
                        <Plus size={12} /> Inserir condutor que sai
                      </button>
                    )}

                    {(selectedEdge.replacementFromConductors ?? []).map(
                      (entry) => (
                        <div
                          key={entry.id}
                          className="mt-2 grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2"
                        >
                          <input
                            type="number"
                            min={1}
                            value={entry.quantity}
                            title={`Quantidade do condutor de saída ${entry.id}`}
                            onChange={(e) => {
                              const quantity = Math.max(
                                1,
                                numberFromInput(e.target.value),
                              );
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).map((item) =>
                                  item.id === entry.id
                                    ? { ...item, quantity }
                                    : item,
                                ),
                              );
                            }}
                            className="w-full min-w-0 rounded border border-amber-300 bg-white p-1.5 text-[11px] text-slate-800"
                          />
                          <select
                            value={entry.conductorName}
                            title={`Tipo do condutor de saída ${entry.id}`}
                            onChange={(e) => {
                              const conductorName = e.target.value;
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).map((item) =>
                                  item.id === entry.id
                                    ? { ...item, conductorName }
                                    : item,
                                ),
                              );
                            }}
                            className="min-w-0 w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] text-slate-800"
                          >
                            {CONDUCTOR_NAMES.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).filter((item) => item.id !== entry.id),
                              );
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            title="Remover condutor de saída"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}

                <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700">
                  {getEdgeChangeFlag(selectedEdge) === "remove" && (
                    <div className="mb-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">
                      Trecho marcado para remoção na execução do projeto.
                    </div>
                  )}
                  {getEdgeChangeFlag(selectedEdge) === "replace" && (
                    <div className="mb-1 rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-yellow-800">
                      Substituição: no DXF serão enviados condutor que entra e
                      condutor que sai.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Sigma size={12} />
                    <span>
                      Total de trechos no projeto: {btTopology.edges.length}
                    </span>
                  </div>
                  <div className="mt-1">
                    Metragem do trecho selecionado: {selectedEdgeLengthLabel}
                  </div>
                  <div className="mt-1 grid grid-cols-[auto_120px] items-center gap-2">
                    <span>Metragem CQT manual (m):</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number(
                        selectedEdge.cqtLengthMeters ??
                          selectedEdge.lengthMeters ??
                          0,
                      )}
                      onChange={(e) => {
                        updateEdgeCqtLengthMeters(
                          selectedEdge.id,
                          numberFromInput(e.target.value),
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white p-1 text-[11px] text-slate-800"
                      title="Metragem CQT utilizada no cálculo de tensão"
                    />
                  </div>
                  <div>Metragem total da rede: {totalNetworkLengthLabel}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BtTopologyPanel;
