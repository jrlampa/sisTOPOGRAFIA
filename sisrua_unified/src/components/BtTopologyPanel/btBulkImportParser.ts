import { BtTopology, BtPoleNode, BtPoleRamalEntry } from "../../types";
import { nextId } from "./BtTopologyPanelUtils";

export const normalizeHeaderKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_.-]/g, "")
    .toUpperCase();

export const resolveRamalTypeFromHeader = (header: string): string | null => {
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

export const parseBulkRamalQuantity = (value: string | undefined): number => {
  if (!value) return 0;
  const cleaned = value.trim().replace(/[^0-9]/g, "");
  if (!cleaned) return 0;
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const extractPointNumber = (value: string): string | null => {
  const token = value.match(/\d+/)?.[0] ?? "";
  return token.length > 0 ? token : null;
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

export const buildTopologyWithBulkRamais = (
  rawInput: string,
  sourceTopology: BtTopology,
): { nextTopology: BtTopology; insertedRamais: number; countPoles: number; notFoundPoles: string[] } | null => {
  const raw = rawInput.trim();
  if (!raw) return null;

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) return null;

  const splitCells = (line: string) => line.includes("\t") ? line.split("\t") : line.split(";");
  const table = lines.map((line) => splitCells(line).map((cell) => cell.trim()));

  const headerIndex = table.findIndex((cells) => {
    const first = normalizeHeaderKey(cells[0] ?? "");
    return first.includes("POSTE") || first === "NDOPOSTE" || first === "NUMEROPOSTE";
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

  const poleByNumber = new Map<string, BtPoleNode>();
  for (const pole of sourceTopology.poles) {
    const idDigits = pole.id.match(/\d+/)?.[0];
    if (idDigits) poleByNumber.set(idDigits, pole);
    const titleDigits = pole.title.match(/\d+/)?.[0];
    if (titleDigits) poleByNumber.set(titleDigits, pole);
  }

  const appendByPoleId = new Map<string, BtPoleRamalEntry[]>();
  const notFoundPoles: string[] = [];
  let insertedRamais = 0;

  table.slice(effectiveHeaderIndex + 1).forEach((row) => {
    const poleTokenRaw = (row[0] ?? "").trim();
    if (!poleTokenRaw) return;

    const poleNumber = poleTokenRaw.match(/\d+/)?.[0] ?? "";
    const pole = poleByNumber.get(poleNumber);

    if (!pole) {
      notFoundPoles.push(poleTokenRaw);
      return;
    }

    columnToRamalType.forEach((ramalType, colIndex) => {
      const quantity = parseBulkRamalQuantity(row[colIndex]);
      if (quantity <= 0) return;

      const current = appendByPoleId.get(pole.id) ?? [];
      current.push({ id: nextId("RP"), quantity, ramalType });
      appendByPoleId.set(pole.id, current);
      insertedRamais += quantity;
    });
  });

  if (appendByPoleId.size === 0) return null;

  const nextTopology: BtTopology = {
    ...sourceTopology,
    poles: sourceTopology.poles.map((pole) => {
      const append = appendByPoleId.get(pole.id);
      if (!append || append.length === 0) return pole;
      return { ...pole, ramais: [...(pole.ramais ?? []), ...append] };
    }),
  };

  return { nextTopology, insertedRamais, countPoles: appendByPoleId.size, notFoundPoles };
};
