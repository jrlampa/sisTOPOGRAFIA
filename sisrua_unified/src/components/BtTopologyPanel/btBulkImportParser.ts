import { BtTopology, BtPoleNode, BtPoleRamalEntry } from "../../types";
import { nextId } from "./BtTopologyPanelUtils";

// Pre-compiled regex for O(1) matching during loop
const DIGITS_REGEX = /\d+/;
const CLEAN_NUMBER_REGEX = /[^0-9]/g;
const WORKBOOK_CLEAN_REGEX = /[^0-9,.-]/g;
const WHITESPACE_REGEX = /\s+/g;
const BOM_REGEX = /^\uFEFF/;
const LINE_BREAK_REGEX = /\r\n?/g;

export const normalizeHeaderKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(WHITESPACE_REGEX, "")
    .replace(/[_.-]/g, "")
    .toUpperCase();

export const resolveRamalTypeFromHeader = (header: string): string | null => {
  const key = normalizeHeaderKey(header);

  // Fast lookup for common keys
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

export const parseBulkRamalQuantity = (value: string | undefined): number => {
  if (!value) return 0;
  const cleaned = value.trim().replace(CLEAN_NUMBER_REGEX, "");
  if (!cleaned) return 0;
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const extractPointNumber = (value: string): string | null => {
  const match = value.match(DIGITS_REGEX);
  return match ? match[0] : null;
};

export const parseWorkbookNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const sanitizeWorkbookText = (value: string): string =>
  value
    .replace(BOM_REGEX, "")
    .replace(LINE_BREAK_REGEX, "\n")
    .trim();

/**
 * Builds the topology by batch-processing ramal insertions.
 * Optimized for O(N) performance on large datasets.
 */
export const buildTopologyWithBulkRamais = (
  rawInput: string,
  sourceTopology: BtTopology,
): {
  nextTopology: BtTopology;
  insertedRamais: number;
  countPoles: number;
  notFoundPoles: string[];
} | null => {
  const raw = rawInput.trim();
  if (!raw) return null;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return null;

  // Use tab as primary separator, fallback to semicolon
  const separator = lines[0].includes("\t") ? "\t" : ";";
  const table = lines.map((line) =>
    line.split(separator).map((cell) => cell.trim()),
  );

  const headerIndex = table.findIndex((cells) => {
    const first = normalizeHeaderKey(cells[0] ?? "");
    return (
      first.includes("POSTE") || first === "NDOPOSTE" || first === "NUMEROPOSTE"
    );
  });

  const effectiveHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
  const headers = table[effectiveHeaderIndex] ?? [];
  const columnToRamalType = new Map<number, string>();

  headers.forEach((header, index) => {
    if (index === 0) return;
    const ramalType = resolveRamalTypeFromHeader(header);
    if (ramalType) columnToRamalType.set(index, ramalType);
  });

  if (columnToRamalType.size === 0) return null;

  // Pre-calculate pole map for O(1) lookup
  const poleByNumber = new Map<string, BtPoleNode>();
  for (const pole of sourceTopology.poles) {
    const idMatch = pole.id.match(DIGITS_REGEX);
    if (idMatch) poleByNumber.set(idMatch[0], pole);
    
    const titleMatch = pole.title.match(DIGITS_REGEX);
    if (titleMatch) poleByNumber.set(titleMatch[0], pole);
  }

  const appendByPoleId = new Map<string, BtPoleRamalEntry[]>();
  const notFoundPoles: string[] = [];
  let insertedRamais = 0;

  // Single pass through data rows
  for (let i = effectiveHeaderIndex + 1; i < table.length; i++) {
    const row = table[i];
    const poleTokenRaw = (row[0] ?? "").trim();
    if (!poleTokenRaw) continue;

    const poleNumberMatch = poleTokenRaw.match(DIGITS_REGEX);
    const poleNumber = poleNumberMatch ? poleNumberMatch[0] : "";
    const pole = poleByNumber.get(poleNumber);

    if (!pole) {
      notFoundPoles.push(poleTokenRaw);
      continue;
    }

    const currentPolesRamais: BtPoleRamalEntry[] = [];
    columnToRamalType.forEach((ramalType, colIndex) => {
      const quantity = parseBulkRamalQuantity(row[colIndex]);
      if (quantity <= 0) return;

      currentPolesRamais.push({ id: nextId("RP"), quantity, ramalType });
      insertedRamais += quantity;
    });

    if (currentPolesRamais.length > 0) {
      const existing = appendByPoleId.get(pole.id) ?? [];
      appendByPoleId.set(pole.id, [...existing, ...currentPolesRamais]);
    }
  }

  if (appendByPoleId.size === 0) return null;

  // Efficient batch update of topology
  const nextTopology: BtTopology = {
    ...sourceTopology,
    poles: sourceTopology.poles.map((pole) => {
      const append = appendByPoleId.get(pole.id);
      if (!append || append.length === 0) return pole;
      return { ...pole, ramais: [...(pole.ramais ?? []), ...append] };
    }),
  };

  return {
    nextTopology,
    insertedRamais,
    countPoles: appendByPoleId.size,
    notFoundPoles,
  };
};
