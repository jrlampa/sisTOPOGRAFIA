/**
 * workbookReader.ts
 *
 * Browser-safe workbook reader backed by ExcelJS.
 * Exposes a SheetJS-compatible surface (SheetNames, Sheets[name], sheet[addr].v,
 * utils.sheet_to_csv, utils.sheet_to_json) so callers need minimal changes.
 */

import type ExcelJS from 'exceljs';

// ─── Public types ────────────────────────────────────────────────────────────

export type ShimCellValue = string | number | boolean | Date | null;

export interface ShimCell {
  /** Raw cell value (mirrors SheetJS `.v` property) */
  v: ShimCellValue;
}

/**
 * A sheet represented as a flat Record keyed by cell address (e.g. "A1", "AA15").
 * Mirrors the SheetJS `WorkSheet` object shape used in this codebase.
 */
export type ShimSheet = Record<string, ShimCell>;

/**
 * A workbook with SheetJS-compatible `SheetNames` and `Sheets` properties.
 */
export interface ShimWorkbook {
  SheetNames: string[];
  Sheets: Record<string, ShimSheet>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a 1-based column index to a letter string (e.g. 1→"A", 27→"AA"). */
function colIndexToLetters(col: number): string {
  let result = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    col = Math.floor((col - 1) / 26);
  }
  return result;
}

/** Parse column letters into a 1-based index (e.g. "A"→1, "AA"→27). */
function colLettersToIndex(letters: string): number {
  return letters
    .toUpperCase()
    .split('')
    .reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
}

/** Normalize an ExcelJS CellValue to a plain scalar. */
function normalizeCellValue(v: ExcelJS.CellValue): ShimCellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    // RichTextValue
    if ('richText' in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    }
    // FormulaValue — use calculated result
    if ('result' in v) {
      const result = (v as ExcelJS.CellFormulaValue).result;
      if (result instanceof Error) return null;
      return normalizeCellValue(result as ExcelJS.CellValue);
    }
    // HyperlinkValue
    if ('text' in v) {
      return (v as ExcelJS.CellHyperlinkValue).text;
    }
    // SharedStringValue (some ExcelJS versions)
    if ('sharedFormula' in v) {
      const sf = v as ExcelJS.CellSharedFormulaValue;
      if ('result' in sf) {
        const res = (sf as any).result;
        if (res instanceof Error) return null;
        return normalizeCellValue(res);
      }
      return null;
    }
  }
  return v as ShimCellValue;
}

/** Convert an ExcelJS worksheet to a ShimSheet (cell-address→ShimCell map). */
function worksheetToShimSheet(ws: ExcelJS.Worksheet): ShimSheet {
  const sheet: ShimSheet = {};
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row.values is 1-indexed; index 0 is always undefined
    for (let colIdx = 1; colIdx < values.length; colIdx++) {
      const rawValue = values[colIdx];
      if (rawValue === null || rawValue === undefined) continue;
      const normalized = normalizeCellValue(rawValue);
      if (normalized === null) continue;
      const addr = `${colIndexToLetters(colIdx)}${rowNum}`;
      sheet[addr] = { v: normalized };
    }
  });
  return sheet;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Parse an Excel workbook from an ArrayBuffer (e.g. from `file.arrayBuffer()`).
 * Returns a ShimWorkbook whose `SheetNames` and `Sheets[name]` mirror the
 * SheetJS API used throughout the codebase.
 */
export async function readWorkbook(buffer: ArrayBuffer): Promise<ShimWorkbook> {
  const ExcelJSMod = await import('exceljs');
  const ExcelJSCtor = (ExcelJSMod as any).default ?? ExcelJSMod;
  const wb: ExcelJS.Workbook = new ExcelJSCtor.Workbook();
  // ExcelJS accepts Uint8Array in both Node.js and browser environments
  await wb.xlsx.load(new Uint8Array(buffer) as unknown as Buffer);

  const SheetNames = wb.worksheets.map((ws) => ws.name);
  const Sheets: Record<string, ShimSheet> = {};
  for (const ws of wb.worksheets) {
    Sheets[ws.name] = worksheetToShimSheet(ws);
  }
  return { SheetNames, Sheets };
}

// ─── Utilities (mirror XLSX.utils subset) ────────────────────────────────────

function getSheetDimensions(
  sheet: ShimSheet,
): { maxRow: number; maxCol: number; rowsMap: Map<number, Map<number, ShimCellValue>> } {
  const rowsMap = new Map<number, Map<number, ShimCellValue>>();
  let maxRow = 0;
  let maxCol = 0;

  for (const [addr, cell] of Object.entries(sheet)) {
    const match = /^([A-Z]+)(\d+)$/.exec(addr);
    if (!match) continue;
    const col = colLettersToIndex(match[1]);
    const row = parseInt(match[2], 10);
    if (!rowsMap.has(row)) rowsMap.set(row, new Map());
    rowsMap.get(row)!.set(col, cell.v);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }

  return { maxRow, maxCol, rowsMap };
}

export const utils = {
  /**
   * Convert a ShimSheet to a delimiter-separated string.
   * Options mirror the SheetJS `sheet_to_csv` signature used in this codebase.
   */
  sheet_to_csv(
    sheet: ShimSheet,
    options: { FS?: string; blankrows?: boolean } = {},
  ): string {
    const fs = options.FS ?? ',';
    const { maxRow, maxCol, rowsMap } = getSheetDimensions(sheet);
    const csvRows: string[] = [];

    for (let r = 1; r <= maxRow; r++) {
      const rowData = rowsMap.get(r);
      if (!rowData && options.blankrows === false) continue;

      const cells: string[] = [];
      for (let c = 1; c <= maxCol; c++) {
        const v = rowData?.get(c);
        cells.push(v !== null && v !== undefined ? String(v) : '');
      }

      if (options.blankrows === false && cells.every((c) => c === '')) continue;
      csvRows.push(cells.join(fs));
    }

    return csvRows.join('\n');
  },

  /**
   * Convert a ShimSheet to a 2-D array (header:1 mode only).
   * Options mirror the SheetJS `sheet_to_json` signature used in this codebase.
   */
  sheet_to_json(
    sheet: ShimSheet,
    options: { header?: 1; blankrows?: boolean; defval?: unknown; raw?: boolean } = {},
  ): unknown[][] {
    const defval = options.defval !== undefined ? options.defval : '';
    const { maxRow, maxCol, rowsMap } = getSheetDimensions(sheet);
    const result: unknown[][] = [];

    for (let r = 1; r <= maxRow; r++) {
      const rowData = rowsMap.get(r);
      if (!rowData && options.blankrows === false) continue;

      const cells: unknown[] = [];
      for (let c = 1; c <= maxCol; c++) {
        const v = rowData?.get(c);
        cells.push(v !== undefined && v !== null ? v : defval);
      }

      if (
        options.blankrows === false &&
        cells.every((c) => c === defval || c === '' || c === null || c === undefined)
      ) {
        continue;
      }

      result.push(cells);
    }

    return result;
  },
};
