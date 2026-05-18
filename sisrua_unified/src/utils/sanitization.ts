/**
 * Data Sanitization Utilities
 * Enforces strict input validation and XSS/SQL injection prevention
 *
 * Regra não negociável: Todos os inputs de usuário devem ser sanitizados
 */
import { AppLocale } from "../types";
import { getUtilsText } from "../i18n/utilsText";

/**
 * Sanitize string input - remove potentially dangerous characters
 * @param input User input string
 * @param maxLength Maximum allowed length (default: 255)
 * @param locale Current app locale
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength = 255, locale: AppLocale = "pt-BR"): string {
  const t = getUtilsText(locale).sanitization;
  if (typeof input !== "string") {
    throw new Error(t.stringExpected);
  }

  const sanitized = input
    .trim()
    .substring(0, maxLength)
    // Remove script tags and event handlers
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    // Escape HTML entities
    .replace(
      /[<>]/g,
      (char) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
        })[char] || char,
    );

  return sanitized;
}

/**
 * Validate coordinates
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @returns true if valid
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return false;
  }

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false;
  }

  return true;
}

/**
 * Sanitize file name - prevent path traversal and XSS
 * @param filename Original filename
 * @param locale Current app locale
 * @returns Safe filename
 */
export function sanitizeFileName(filename: string, locale: AppLocale = "pt-BR"): string {
  const t = getUtilsText(locale).sanitization;
  if (typeof filename !== "string") {
    throw new Error(t.stringExpected);
  }

  return filename
    .replace(/\.\./g, "") // Prevent directory traversal
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/^\.+/, "") // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Sanitize numeric input
 * @param input User input
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param locale Current app locale
 * @returns Validated number or throws
 */
export function sanitizeNumber(
  input: any,
  min = -Infinity,
  max = Infinity,
  locale: AppLocale = "pt-BR",
): number {
  const t = getUtilsText(locale).sanitization;
  const num = Number(input);

  if (Number.isNaN(num)) {
    throw new Error(t.invalidNumber);
  }

  if (num < min || num > max) {
    // Replace placeholders manually for util functions (no i18next instance here)
    const msg = t.numberRange.replace("{{min}}", String(min)).replace("{{max}}", String(max));
    throw new Error(msg);
  }

  return num;
}

/**
 * Escape SQL string literal
 * NOTE: This is for reference only. Use parameterized queries instead!
 * @param input User input
 * @param locale Current app locale
 * @returns Escaped string
 */
export function escapeSqlString(input: string, locale: AppLocale = "pt-BR"): string {
  const t = getUtilsText(locale).sanitization;
  if (typeof input !== "string") {
    throw new Error(t.stringExpected);
  }

  return input.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

/**
 * Validate email format
 * @param email Email address
 * @returns true if valid email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Escape CSV cell (prevent formula injection)
 * @param cell CSV cell value
 * @returns Escaped cell
 */
export function escapeCsvCell(cell: any): string {
  const str = String(cell);

  // Prevent formula injection
  if (str.match(/^[=+\-@]/)) {
    return "'" + str;
  }

  // Escape quotes
  if (str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  // Wrap in quotes if contains comma, newline, or quote
  if (str.match(/[,\n"]/)) {
    return '"' + str + '"';
  }

  return str;
}

/**
 * Validate JSON is safe
 * @param jsonString JSON string to validate
 * @param locale Current app locale
 * @returns Parsed object or throws
 */
export function validateAndParseJson<T>(jsonString: string, locale: AppLocale = "pt-BR"): T {
  const t = getUtilsText(locale).sanitization;
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch {
    throw new Error(t.invalidJson);
  }
}

/**
 * Sanitize object recursively
 * @param obj Object to sanitize
 * @param locale Current app locale
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  locale: AppLocale = "pt-BR",
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      (sanitized as any)[key] = sanitizeString(value, 255, locale);
    } else if (typeof value === "number") {
      (sanitized as any)[key] = sanitizeNumber(value, -Infinity, Infinity, locale);
    } else if (Array.isArray(value)) {
      (sanitized as any)[key] = value.map((v) =>
        typeof v === "string" ? sanitizeString(v, 255, locale) : v,
      );
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (sanitized as any)[key] = sanitizeObject(value, locale);
    } else {
      (sanitized as any)[key] = value;
    }
  }

  return sanitized;
}
