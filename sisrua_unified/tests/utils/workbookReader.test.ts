import { describe, it, expect } from 'vitest';
import { utils } from '../../src/utils/workbookReader';
import type { ShimSheet } from '../../src/utils/workbookReader';

/** Build a minimal ShimSheet from a 2-D array (row-major, 1-indexed). */
function makeSheet(rows: Array<Array<string | number | null>>): ShimSheet {
  const sheet: ShimSheet = {};
  rows.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      if (val === null || val === undefined) return;
      const col = colIdx + 1;
      const rowNum = rowIdx + 1;
      // col index → letters
      let colLetters = '';
      let c = col;
      while (c > 0) {
        const rem = (c - 1) % 26;
        colLetters = String.fromCharCode(65 + rem) + colLetters;
        c = Math.floor((c - 1) / 26);
      }
      sheet[`${colLetters}${rowNum}`] = { v: val };
    });
  });
  return sheet;
}

describe('workbookReader utils', () => {
  describe('sheet_to_csv', () => {
    it('converts a simple sheet to comma-separated values', () => {
      const sheet = makeSheet([
        ['Name', 'Age'],
        ['Alice', 30],
        ['Bob', 25],
      ]);
      const csv = utils.sheet_to_csv(sheet);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Name,Age');
      expect(lines[1]).toBe('Alice,30');
      expect(lines[2]).toBe('Bob,25');
    });

    it('respects custom field separator (FS)', () => {
      const sheet = makeSheet([['A', 'B'], ['1', '2']]);
      const csv = utils.sheet_to_csv(sheet, { FS: '\t' });
      expect(csv.split('\n')[0]).toBe('A\tB');
    });

    it('skips blank rows when blankrows is false', () => {
      const sheet = makeSheet([
        ['A', 'B'],
        [null, null],
        ['C', 'D'],
      ]);
      const csv = utils.sheet_to_csv(sheet, { blankrows: false });
      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('A,B');
      expect(lines[1]).toBe('C,D');
    });

    it('returns empty string for empty sheet', () => {
      const csv = utils.sheet_to_csv({});
      expect(csv).toBe('');
    });

    it('fills empty cells with empty string', () => {
      const sheet = makeSheet([
        ['A', null, 'C'],
      ]);
      const csv = utils.sheet_to_csv(sheet);
      expect(csv).toBe('A,,C');
    });
  });

  describe('sheet_to_json', () => {
    it('returns 2-D array in header:1 mode', () => {
      const sheet = makeSheet([
        ['PONTO', 'TRECHO', 'M'],
        [1, 0, 100],
        [2, 1, 50],
      ]);
      const rows = utils.sheet_to_json(sheet, { header: 1, raw: true });
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['PONTO', 'TRECHO', 'M']);
      expect(rows[1]).toEqual([1, 0, 100]);
    });

    it('respects defval for missing cells', () => {
      const sheet = makeSheet([
        ['A', null, 'C'],
      ]);
      const rows = utils.sheet_to_json(sheet, { header: 1, defval: null });
      expect(rows[0]).toEqual(['A', null, 'C']);
    });

    it('skips blank rows when blankrows is false', () => {
      const sheet = makeSheet([
        ['A', 'B'],
        [null, null],
        ['C', 'D'],
      ]);
      const rows = utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(['A', 'B']);
      expect(rows[1]).toEqual(['C', 'D']);
    });

    it('returns empty array for empty sheet', () => {
      const rows = utils.sheet_to_json({}, { header: 1 });
      expect(rows).toHaveLength(0);
    });

    it('handles multi-letter column addresses (AA, AB …)', () => {
      // Simulate a sheet wider than 26 columns by placing something at AA1
      const sheet: ShimSheet = { AA1: { v: 'wide' } };
      const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' });
      // AA is column 27; should have 26 empty cells before it
      expect(rows[0]).toHaveLength(27);
      expect(rows[0][26]).toBe('wide');
    });
  });
});
