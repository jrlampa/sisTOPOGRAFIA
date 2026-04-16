import React from "react";
import type {
  BtEdge,
  BtPoleNode,
  BtPoleRamalEntry,
  BtTopology,
} from "../../types";
import { CONDUCTOR_NAMES, nextId } from "./BtTopologyPanelUtils";
import { DEFAULT_TEMPERATURE_FACTOR } from "../../constants/btPhysicalConstants";

const MAX_WORKBOOK_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_WORKBOOK_EXTENSIONS = [".xlsx", ".xlsm", ".xlsb"];

const hasAllowedWorkbookExtension = (filename: string): boolean => {
  const normalized = filename.toLowerCase();
  return ALLOWED_WORKBOOK_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

const sanitizeWorkbookText = (raw: string): string => {
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
};

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
  onProjectTypeChange,
  onClandestinoAreaChange,
}: UseBtTopologyPanelBulkImportParams) => {
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

    if (key === "33AA") return "5 CC";
    if (key === "33AC") return "8 CC";
    if (key === "53AA") return "13 CC";
    if (key === "53AC") return "21 CC";
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
    const transformers = [] as any[];

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
      if (!hasAllowedWorkbookExtension(file.name)) {
        setBulkRamalFeedback(
          "Arquivo inválido. Envie planilha .xlsx, .xlsm ou .xlsb.",
        );
        return;
      }

      if (file.size <= 0 || file.size > MAX_WORKBOOK_UPLOAD_BYTES) {
        setBulkRamalFeedback(
          "Arquivo inválido: tamanho deve ser maior que 0 e até 5 MB.",
        );
        return;
      }

      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        dense: true,
        WTF: false,
        cellFormula: false,
      });

      const sheetName =
        workbook.SheetNames.find(
          (name) => normalizeHeaderKey(name) === "RAMAL",
        ) ?? workbook.SheetNames[0];

      if (!sheetName) {
        setBulkRamalFeedback("Planilha sem abas legiveis.");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const raw = sanitizeWorkbookText(
        XLSX.utils.sheet_to_csv(sheet, {
          FS: "\t",
          blankrows: false,
          strip: true,
        }),
      );

      if (raw.length > 300_000) {
        setBulkRamalFeedback(
          "Planilha muito grande para importação segura. Reduza o conteúdo da aba RAMAL.",
        );
        return;
      }

      if (!raw.trim()) {
        setBulkRamalFeedback(`A aba ${sheetName} esta vazia.`);
        return;
      }

      if (!raw.includes("\t")) {
        setBulkRamalFeedback(
          `A aba ${sheetName} não possui formato tabular esperado para importação.`,
        );
        return;
      }

      const sanitizedRaw = raw.replace(/^[=+\-@]/gm, "'");
      setBulkRamalText(sanitizedRaw);

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
          raw: sanitizedRaw,
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
            sanitizedRaw,
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
            `Poste ${firstPole.id} sem ramais válidos para importar.${workbookSettingsLabel}`,
          );
        };

        setTimeout(applyFirstPoleRamais, 0);
        return;
      }

      setBulkImportReview(null);
      applyBulkRamalInsertFromRaw(sanitizedRaw);
      if (workbookSettingsLabel) {
        setBulkRamalFeedback((prev) => `${prev}${workbookSettingsLabel}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "erro desconhecido";
      setBulkRamalFeedback(`Falha ao ler planilha Excel: ${message}`);
    }
  };

  return {
    isBulkRamalModalOpen,
    setIsBulkRamalModalOpen,
    bulkRamalText,
    setBulkRamalText,
    bulkRamalFeedback,
    setBulkRamalFeedback,
    isBulkDropActive,
    setIsBulkDropActive,
    bulkImportReview,
    setBulkImportReview,
    bulkFileInputRef,
    handleReviewApplyCurrentPoleRamais,
    handleReviewSkipCurrentPole,
    handleReviewNextPole,
    applyBulkRamalInsert,
    importBulkRamaisFromWorkbook,
  };
};
