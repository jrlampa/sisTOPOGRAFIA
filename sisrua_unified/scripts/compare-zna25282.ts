import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { computeBtDerivedState } from "../server/services/btDerivedService.js";

type CompareRow = {
  point: string;
  excelLocal: number | null;
  appLocal: number | null;
  deltaLocal: number | null;
  excelAccum: number | null;
  appAccum: number | null;
  deltaAccum: number | null;
  excelVoltage: number | null;
  appVoltage: number | null;
  deltaVoltage: number | null;
};

type ExcelPointRow = {
  point: string;
  localTrechoKva: number | null;
  accumulatedKva: number | null;
  voltageV: number | null;
};

const WORKBOOK_PATH =
  process.env.WORKBOOK_PATH ??
  "C:/Users/jonat/OneDrive - IM3 Brasil/LIGHT/PROJETOS/ZNA25282 - ROBUSTEZ DE BT/ZNA25282 - ROBUSTEZ DE BT_2.xlsx";
const SRUA_PATH =
  process.env.SRUA_PATH ??
  "C:/Users/jonat/OneDrive - IM3 Brasil/LIGHT/PROJETOS/ZNA25282 - ROBUSTEZ DE BT/ZNA25282 - ROBUSTEZ DE BT.srua";

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_.-]/g, "")
    .toUpperCase();

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const findSheetName = (sheetNames: string[], prefix: string): string => {
  const wanted = normalize(prefix);
  const found = sheetNames.find((name) => normalize(name).startsWith(wanted));
  if (!found) {
    throw new Error(`Sheet starting with '${prefix}' not found.`);
  }
  return found;
};

const extractPointNumber = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d+/);
  return match ? String(Number.parseInt(match[0], 10)) : null;
};

/** Normalize an ExcelJS CellValue to a plain scalar. */
function normalizeCellValue(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r: ExcelJS.RichText) => r.text).join("");
    if ("result" in v) {
      const res = (v as ExcelJS.CellFormulaValue).result;
      if (res instanceof Error) return null;
      return normalizeCellValue(res as ExcelJS.CellValue);
    }
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
  }
  return null;
}

/** Read worksheet rows as a 2-D array (equivalent to XLSX.utils.sheet_to_json with header:1). */
function worksheetToRows(ws: ExcelJS.Worksheet): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  ws.eachRow({ includeEmpty: false }, (row: ExcelJS.Row) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row.values is 1-indexed; index 0 is always undefined
    const cells = values.slice(1).map(normalizeCellValue);
    rows.push(cells);
  });
  return rows;
}

const readExcelGeralPoints = async (workbookPath: string): Promise<ExcelPointRow[]> => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(workbookPath);

  const geralSheetName = findSheetName(
    wb.worksheets.map((ws) => ws.name),
    "GERAL",
  );
  const ws = wb.getWorksheet(geralSheetName);
  if (!ws) throw new Error(`Sheet '${geralSheetName}' not found in workbook.`);

  const rows = worksheetToRows(ws);

  const headerRowIndex = rows.findIndex((row) => {
    const keys = row.map((cell) => normalize(cell));
    return (
      keys.includes("PONTO") &&
      keys.includes("TRECHO") &&
      keys.includes("TOTALDOTRECHO") &&
      keys.includes("ACUMULADA")
    );
  });

  if (headerRowIndex < 0) {
    throw new Error("Could not find GERAL header row (PONTO/TRECHO).");
  }

  const headers = rows[headerRowIndex].map((h) => normalize(h));
  const pointIdx = headers.findIndex((h) => h === "PONTO");
  const localIdx = headers.findIndex((h) => h === "TOTALDOTRECHO");
  const accumIdx = headers.findIndex((h) => h === "ACUMULADA");
  const voltageIdx = headers.findIndex((h) => h === "CQTNOPONTO");

  if (pointIdx < 0 || localIdx < 0 || accumIdx < 0) {
    throw new Error(
      "Required columns not found in GERAL (PONTO/TOTAL DO TRECHO/ACUMULADA).",
    );
  }

  const result: ExcelPointRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const pointNum = extractPointNumber(row[pointIdx]);
    if (!pointNum) {
      continue;
    }

    result.push({
      point: pointNum,
      localTrechoKva: toNumber(row[localIdx]),
      accumulatedKva: toNumber(row[accumIdx]),
      voltageV: voltageIdx >= 0 ? toNumber(row[voltageIdx]) : null,
    });
  }

  return result;
};

const loadSruaState = (sruaPath: string): any => {
  const raw = fs.readFileSync(sruaPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !parsed.state) {
    throw new Error("Invalid .srua content: missing state.");
  }
  return parsed.state;
};

const round2 = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
};

const main = async () => {
  const excelPoints = await readExcelGeralPoints(WORKBOOK_PATH);
  const state = loadSruaState(SRUA_PATH);

  const topology = state.btTopology ?? {
    poles: [],
    transformers: [],
    edges: [],
  };
  const projectType = (state.settings?.projectType ?? "ramais") as
    | "ramais"
    | "geral"
    | "clandestino";
  const clandestinoAreaM2 = Number(state.settings?.clandestinoAreaM2 ?? 0);

  const derived = computeBtDerivedState(
    topology,
    projectType,
    clandestinoAreaM2,
  );

  const poleById = new Map((topology.poles ?? []).map((p: any) => [p.id, p]));
  const appByPoint = new Map<
    string,
    {
      localTrechoKva: number | null;
      accumulatedKva: number | null;
      voltageV: number | null;
    }
  >();

  for (const entry of derived.accumulatedByPole ?? []) {
    const pole = poleById.get(entry.poleId);
    if (!pole) continue;

    const point = extractPointNumber(pole.title) ?? extractPointNumber(pole.id);
    if (!point) continue;

    appByPoint.set(point, {
      localTrechoKva: round2(entry.localTrechoDemandKva ?? null),
      accumulatedKva: round2(entry.accumulatedDemandKva ?? null),
      voltageV: round2(entry.voltageV ?? null),
    });
  }

  const rows: CompareRow[] = excelPoints.map((excel) => {
    const app = appByPoint.get(excel.point);

    const appLocal = app?.localTrechoKva ?? null;
    const appAccum = app?.accumulatedKva ?? null;
    const appVoltage = app?.voltageV ?? null;

    const excelLocal = round2(excel.localTrechoKva);
    const excelAccum = round2(excel.accumulatedKva);
    const excelVoltage = round2(excel.voltageV);

    return {
      point: excel.point,
      excelLocal,
      appLocal,
      deltaLocal:
        excelLocal !== null && appLocal !== null
          ? round2(appLocal - excelLocal)
          : null,
      excelAccum,
      appAccum,
      deltaAccum:
        excelAccum !== null && appAccum !== null
          ? round2(appAccum - excelAccum)
          : null,
      excelVoltage,
      appVoltage,
      deltaVoltage:
        excelVoltage !== null && appVoltage !== null
          ? round2(appVoltage - excelVoltage)
          : null,
    };
  });

  const matched = rows.filter(
    (r) => r.appLocal !== null || r.appAccum !== null || r.appVoltage !== null,
  );

  const mae = (values: Array<number | null>): number | null => {
    const nums = values.filter(
      (v): v is number => v !== null && Number.isFinite(v),
    );
    if (nums.length === 0) return null;
    return round2(nums.reduce((acc, n) => acc + Math.abs(n), 0) / nums.length);
  };

  const maxAbs = (values: Array<number | null>): number | null => {
    const nums = values.filter(
      (v): v is number => v !== null && Number.isFinite(v),
    );
    if (nums.length === 0) return null;
    return round2(Math.max(...nums.map((n) => Math.abs(n))));
  };

  const summary = {
    workbookRows: rows.length,
    matchedRows: matched.length,
    unmatchedRows: rows.length - matched.length,
    maeLocal: mae(rows.map((r) => r.deltaLocal)),
    maeAccum: mae(rows.map((r) => r.deltaAccum)),
    maeVoltage: mae(rows.map((r) => r.deltaVoltage)),
    maxAbsLocal: maxAbs(rows.map((r) => r.deltaLocal)),
    maxAbsAccum: maxAbs(rows.map((r) => r.deltaAccum)),
    maxAbsVoltage: maxAbs(rows.map((r) => r.deltaVoltage)),
  };

  const topByAccum = [...rows]
    .filter((r) => r.deltaAccum !== null)
    .sort((a, b) => Math.abs(b.deltaAccum ?? 0) - Math.abs(a.deltaAccum ?? 0))
    .slice(0, 20);

  const output = {
    meta: {
      workbookPath: WORKBOOK_PATH,
      sruaPath: SRUA_PATH,
      generatedAt: new Date().toISOString(),
      projectType,
      clandestinoAreaM2,
    },
    summary,
    rows,
    topByAccum,
  };

  const outputPath = path.resolve("tmp-zna25282-compare.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Wrote comparison JSON: ${outputPath}`);
  console.log(JSON.stringify({ summary, topByAccum }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
