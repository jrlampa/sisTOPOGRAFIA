/**
 * Data Sanitization Utilities
 * Enforces strict input validation and XSS/SQL injection prevention
 *
 * Regra não negociável: Todos os inputs de usuário devem ser sanitizados
 */

/**
 * Sanitize string input - remove potentially dangerous characters
 * @param input User input string
 * @param maxLength Maximum allowed length (default: 255)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength = 255): string {
  if (typeof input !== "string") {
    throw new Error("A entrada deve ser uma string");
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
 * @returns Safe filename
 */
export function sanitizeFileName(filename: string): string {
  if (typeof filename !== "string") {
    throw new Error("O nome do arquivo deve ser uma string");
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
 * @returns Validated number or throws
 */
export function sanitizeNumber(
  input: any,
  min = -Infinity,
  max = Infinity,
): number {
  const num = Number(input);

  if (Number.isNaN(num)) {
    throw new Error("A entrada não é um número válido");
  }

  if (num < min || num > max) {
    throw new Error(`O número deve estar entre ${min} e ${max}`);
  }

  return num;
}

/**
 * Escape SQL string literal
 * NOTE: This is for reference only. Use parameterized queries instead!
 * @param input User input
 * @returns Escaped string
 */
export function escapeSqlString(input: string): string {
  if (typeof input !== "string") {
    throw new Error("A entrada deve ser uma string");
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
 * @returns Parsed object or throws
 */
export function validateAndParseJson<T>(jsonString: string): T {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch {
    throw new Error("JSON fornecido é inválido");
  }
}

/**
 * Sanitize object recursively
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      (sanitized as any)[key] = sanitizeString(value);
    } else if (typeof value === "number") {
      (sanitized as any)[key] = sanitizeNumber(value);
    } else if (Array.isArray(value)) {
      (sanitized as any)[key] = value.map((v) =>
        typeof v === "string" ? sanitizeString(v) : v,
      );
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (sanitized as any)[key] = sanitizeObject(value);
    } else {
      (sanitized as any)[key] = value;
    }
  }

  return sanitized;
}
