import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  validateCoordinates,
  sanitizeFileName,
  sanitizeNumber,
  validateEmail,
  escapeCsvCell,
  sanitizeObject,
} from '../src/utils/sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script');
      expect(result).toContain('Hello');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeString(input);
      expect(result).not.toContain('onclick');
    });

    it('should escape HTML entities', () => {
      const input = '<b>Bold</b>';
      const result = sanitizeString(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should respect max length', () => {
      const input = 'a'.repeat(300);
      const result = sanitizeString(input, 100);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('validateCoordinates', () => {
    it('should accept valid coordinates', () => {
      expect(validateCoordinates(-22.825546, -43.325956)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
    });

    it('should reject invalid latitude', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(-91, 0)).toBe(false);
    });

    it('should reject invalid longitude', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(0, -181)).toBe(false);
    });

    it('should reject NaN values', () => {
      expect(validateCoordinates(NaN, 0)).toBe(false);
      expect(validateCoordinates(0, NaN)).toBe(false);
    });

    it('should reject non-number inputs', () => {
      expect(validateCoordinates('0' as any, 0)).toBe(false);
      expect(validateCoordinates(0, null as any)).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('should prevent path traversal', () => {
      const input = '../../etc/passwd.txt';
      const result = sanitizeFileName(input);
      expect(result).not.toContain('..');
    });

    it('should remove invalid characters', () => {
      const input = 'file<name>with"invalid|chars.txt';
      const result = sanitizeFileName(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
    });

    it('should remove leading dots', () => {
      const input = '...hidden_file.txt';
      const result = sanitizeFileName(input);
      expect(result).not.toMatch(/^\.+/);
    });

    it('should limit length', () => {
      const input = 'a'.repeat(300) + '.txt';
      const result = sanitizeFileName(input);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('sanitizeNumber', () => {
    it('should accept valid numbers', () => {
      expect(sanitizeNumber(42)).toBe(42);
      expect(sanitizeNumber('42')).toBe(42);
      expect(sanitizeNumber(-3.14)).toBe(-3.14);
    });

    it('should respect min/max bounds', () => {
      expect(() => sanitizeNumber(101, 0, 100)).toThrow();
      expect(() => sanitizeNumber(-1, 0, 100)).toThrow();
    });

    it('should reject NaN', () => {
      expect(() => sanitizeNumber(NaN)).toThrow();
      expect(() => sanitizeNumber('not a number')).toThrow();
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('escapeCsvCell', () => {
    it('should prevent formula injection', () => {
      const result = escapeCsvCell('=INDIRECT("C2")');
      expect(result).toMatch(/^'/);
    });

    it('should escape quotes', () => {
      const result = escapeCsvCell('Value with "quotes"');
      expect(result).toContain('""');
    });

    it('should wrap values with commas', () => {
      const result = escapeCsvCell('First, Last');
      expect(result).toMatch(/^".*"$/);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values', () => {
      const obj = { name: '<script>alert(1)</script>' };
      const result = sanitizeObject(obj);
      expect(result.name).not.toContain('<script');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          email: 'user@example.com',
          bio: '<img src=x onerror="alert(1)">',
        },
      };
      const result = sanitizeObject(obj);
      expect(result.user?.bio).not.toContain('onerror');
    });

    it('should handle arrays', () => {
      const obj = { tags: ['<b>Bold</b>', 'Normal'] };
      const result = sanitizeObject(obj);
      expect(result.tags?.[0]).not.toContain('<b>');
    });

    it('should sanitize number values using sanitizeNumber', () => {
      const obj = { count: 42, ratio: 0.5 };
      const result = sanitizeObject(obj);
      expect(result.count).toBe(42);
      expect(result.ratio).toBe(0.5);
    });

    it('should pass through boolean and null values via else branch', () => {
      const obj = { active: true, data: null as any, value: false };
      const result = sanitizeObject(obj as any);
      expect(result.active).toBe(true);
      expect(result.data).toBeNull();
      expect(result.value).toBe(false);
    });

    it('should handle arrays with non-string items (passes through as-is)', () => {
      const obj = { ids: [1, 2, 3] };
      const result = sanitizeObject(obj as any);
      expect(result.ids).toEqual([1, 2, 3]);
    });
  });
});

// ---------------------------------------------------------------------------
// Additional tests for full coverage
// ---------------------------------------------------------------------------

import { validateAndParseJson, escapeSqlString } from '../src/utils/sanitization';

describe('validateAndParseJson', () => {
  it('parses valid JSON', () => {
    const result = validateAndParseJson<{ key: string }>('{"key":"value"}');
    expect(result.key).toBe('value');
  });

  it('throws on invalid JSON', () => {
    expect(() => validateAndParseJson('not-json')).toThrow('Invalid JSON provided');
  });

  it('parses JSON array', () => {
    const result = validateAndParseJson<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('escapeSqlString', () => {
  it('escapes single quotes', () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });

  it('escapes backslashes', () => {
    expect(escapeSqlString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('throws when input is not a string', () => {
    expect(() => escapeSqlString(42 as any)).toThrow('Input must be a string');
  });
});

describe('escapeCsvCell – plain string (no special chars)', () => {
  it('returns the string unchanged when it has no special characters', () => {
    const result = escapeCsvCell('plain text');
    expect(result).toBe('plain text');
  });

  it('handles formula injection starting with @', () => {
    expect(escapeCsvCell('@SUM(A1:A10)')).toMatch(/^'/);
  });

  it('handles formula injection starting with +', () => {
    expect(escapeCsvCell('+1')).toMatch(/^'/);
  });

  it('handles newline in string', () => {
    const result = escapeCsvCell('line1\nline2');
    expect(result).toMatch(/^".*"$/s);
  });
});

describe('sanitizeString – throws on non-string', () => {
  it('throws when input is not a string', () => {
    expect(() => sanitizeString(42 as any)).toThrow('Input must be a string');
  });
});

describe('sanitizeFileName – throws on non-string', () => {
  it('throws when filename is not a string', () => {
    expect(() => sanitizeFileName(null as any)).toThrow('Filename must be a string');
  });
});
