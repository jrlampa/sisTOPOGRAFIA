/**
 * Download utilities with security features
 * Handles file downloads with proper validation and XSS prevention
 */
import { AppLocale } from "../types";
import { getUtilsText } from "../i18n/utilsText";

/**
 * Validates and sanitizes filenames to prevent security issues
 * Removes path traversal attempts and null bytes
 * @param filename Raw filename from user input
 * @param locale Current app locale for error messages
 * @returns Safe filename or throws error
 */
export function sanitizeFilename(filename: string, locale: AppLocale = "pt-BR"): string {
  const t = getUtilsText(locale).download;
  if (!filename || typeof filename !== "string") {
    throw new Error(t.emptyFilename);
  }

  // Remove any path components (prevent ../, \\, etc)
  let safe = filename.split(/[\\/]+/).pop() || "download";

  // Remove null bytes and other control characters
  // eslint-disable-next-line no-control-regex -- intentional: sanitize control characters from filenames
  safe = safe.replace(/[\u0000-\u001F\u007F]/g, "");

  // Remove leading/trailing dots and spaces
  safe = safe.replace(/^[.\s]+|[.\s]+$/g, "");

  // Limit length (max 255 for most filesystems)
  safe = safe.substring(0, 255);

  // Ensure we have a valid filename
  if (!safe || safe === ".") {
    throw new Error(t.invalidFilename);
  }

  return safe;
}

/**
 * Downloads blob data with validated filename
 * Prevents XSS attacks through filename injection
 * @param content Text content to download
 * @param mimeType MIME type (e.g., 'text/plain', 'text/csv')
 * @param filename Filename for the download
 * @param locale Current app locale
 */
export function downloadBlob(
  content: string,
  mimeType: string,
  filename: string,
  locale: AppLocale = "pt-BR",
): void {
  const t = getUtilsText(locale).download;
  if (!content) {
    throw new Error(t.emptyContent);
  }

  if (!mimeType || typeof mimeType !== "string") {
    throw new Error(t.invalidMime);
  }

  // Validate and sanitize filename
  const safeFilename = sanitizeFilename(filename, locale);

  // Create blob with specified MIME type
  const blob = new Blob([content], { type: mimeType });

  // Create download link
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    // Set download attribute with sanitized filename
    // This prevents any HTML/JavaScript injection through filename
    anchor.href = url;
    anchor.download = safeFilename;
    anchor.style.display = "none";

    // Append and trigger download
    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup
    document.body.removeChild(anchor);
  } finally {
    // Always revoke the object URL to free memory
    URL.revokeObjectURL(url);
  }
}

/**
 * Downloads text file in a specific encoding
 * @param content Text content
 * @param filename Filename for download
 * @param locale Current app locale
 * @param encoding Character encoding (default: utf-8)
 */
export function downloadText(
  content: string,
  filename: string,
  locale: AppLocale = "pt-BR",
  encoding: string = "utf-8",
): void {
  downloadBlob(content, `text/plain;charset=${encoding}`, filename, locale);
}

/**
 * Downloads CSV file (RFC 4180 compliant)
 * @param content CSV content (already formatted)
 * @param filename Filename for download
 * @param locale Current app locale
 */
export function downloadCsv(content: string, filename: string, locale: AppLocale = "pt-BR"): void {
  downloadBlob(content, "text/csv;charset=utf-8", filename, locale);
}

/**
 * Downloads JSON file
 * @param data JavaScript object to serialize
 * @param filename Filename for download
 * @param locale Current app locale
 * @param pretty Whether to format with indentation (default: true)
 */
export function downloadJson(
  data: any,
  filename: string,
  locale: AppLocale = "pt-BR",
  pretty: boolean = true,
): void {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  downloadBlob(json, "application/json;charset=utf-8", filename, locale);
}

/**
 * Downloads DXF file
 * @param content DXF file content
 * @param filename Filename for download
 * @param locale Current app locale
 */
export function downloadDxf(content: string, filename: string, locale: AppLocale = "pt-BR"): void {
  downloadBlob(content, "application/dxf;charset=utf-8", filename, locale);
}

/**
 * Downloads binary file via URL (e.g., from server)
 * Prefer this for large files instead of downloadBlob
 * @param url URL to download from
 * @param filename Filename for download
 * @param locale Current app locale
 */
export function downloadUrl(url: string, filename: string, locale: AppLocale = "pt-BR"): void {
  const safeFilename = sanitizeFilename(filename, locale);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename;
  anchor.style.display = "none";

  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
  }
}
