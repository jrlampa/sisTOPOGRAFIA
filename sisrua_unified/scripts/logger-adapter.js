/**
 * logger-adapter.js — Adaptador simples para uso em scripts Node.js
 * Evita dependência direta do logger do servidor que pode exigir TSX/Build.
 */
export const logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta) : ''),
};
