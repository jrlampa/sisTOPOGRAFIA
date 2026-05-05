/**
 * server/middleware/validation-enhanced.ts
 * 
 * Validações expandidas com sanitização, limites e detecção de padrões suspeitos.
 * Complementa o validation.ts existente com regras adicionais.
 */

import { Request, Response, NextFunction } from "express";
import { body, query, param } from "express-validator";
import { createHash } from 'crypto';
import { logger } from "../utils/logger.js";

/**
 * Valida complexidade de geometria para evitar DoS
 */
export const validateGeometryComplexity = (req: Request, res: Response, next: NextFunction) => {
  const polygon = req.body?.polygon;

  if (!polygon) {
    return next();
  }

  // Limites de segurança
  const MAX_POINTS = 1000;
  const MAX_POLYGON_SIZE_MB = 5;

  if (Array.isArray(polygon) && polygon.length > MAX_POINTS) {
    logger.warn("Polygon exceeds max points", {
      ip: req.ip,
      points: polygon.length,
      max: MAX_POINTS,
    });
    return res.status(400).json({
      error: "Polygon too complex",
      code: "GEOMETRY_TOO_COMPLEX",
      details: { maxPoints: MAX_POINTS, providedPoints: polygon.length },
    });
  }

  // Verificar tamanho total do payload via header (mais rápido e seguro)
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_SIZE_BYTES = MAX_POLYGON_SIZE_MB * 1024 * 1024;

  if (contentLength > MAX_SIZE_BYTES) {
    logger.warn("Payload exceeds max size (via header)", {
      ip: req.ip,
      sizeBytes: contentLength,
      maxBytes: MAX_SIZE_BYTES,
    });
    return res.status(413).json({
      error: "Payload too large",
      code: "FILE_EXCEEDS_LIMIT",
      details: { maxMb: MAX_POLYGON_SIZE_MB },
    });
  }

  next();
};

/**
 * Detecta padrões suspeitos de injeção SQL / XSS
 */
export const detectSuspiciousPatterns = (req: Request, res: Response, next: NextFunction) => {
  // Allow pentest hardening routes to receive test payloads
  if (req.path.startsWith("/pentest/hardening") || req.path.startsWith("/api/pentest/hardening")) {
    return next();
  }

  const bodyStr = JSON.stringify(req.body);
  const queryStr = JSON.stringify(req.query);
  const combined = `${bodyStr}${queryStr}`.toUpperCase();

  // Padrões comuns de ataque
  const suspiciousPatterns = [
    'UNION SELECT',
    'UNION ALL SELECT',
    '/*',
    '*/',
    '--',
    ';DROP',
    ';DELETE',
    "'; DROP",
    "'; DELETE",
    '<SCRIPT',
    'JAVASCRIPT:',
    'ONCLICK=',
    'ONLOAD=',
  ];

  for (const pattern of suspiciousPatterns) {
    if (combined.includes(pattern)) {
      logger.warn("Suspicious pattern detected", {
        ip: req.ip,
        path: req.path,
        pattern,
      });
      return res.status(400).json({
        error: "Invalid input detected",
        code: "INVALID_INPUT",
      });
    }
  }

  next();
};

/**
 * Validadores expandidos com sanitização
 */
export const validatorsExpanded = {
  // DXF Generation com limites rigorosos (P0 - Auditoria 2024)
  dxfRequest: [
    body("lat").optional().isFloat({ min: -90, max: 90 }).toFloat(),
    body("lon").optional().isFloat({ min: -180, max: 180 }).toFloat(),
    body("radius").optional().isFloat({ min: 1, max: 10000 }).toFloat(),
    body("mode").optional().isIn(["circle", "polygon", "bbox", "ramal", "topology"]),
    
    body("polygon")
      .optional()
      .custom((value) => {
        if (typeof value === 'string') return value.length <= 50000;
        if (Array.isArray(value)) return value.length <= 1000;
        return false;
      })
      .withMessage("Polygon too large or invalid format"),

    body("utm_zone")
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage("Invalid UTM zone (1-60)"),

    body("buffer_m")
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage("Buffer must be 0-10km"),

    body("request_fingerprint")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 256 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid request fingerprint"),

    body("name")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Name must be 1-255 characters"),
  ],

  // Topology validation com limites
  topology: [
    body("poles")
      .isArray({ min: 1, max: 10000 })
      .withMessage("Poles array required (1-10000 items)"),

    body("poles.*.id")
      .isString()
      .trim()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid pole ID format (alphanumeric + underscore/dash, max 50)"),

    body("poles.*.lat")
      .isFloat({ min: -90, max: 90 })
      .toFloat()
      .customSanitizer(value => Math.round(value * 1000000) / 1000000),

    body("poles.*.lon")
      .isFloat({ min: -180, max: 180 })
      .toFloat()
      .customSanitizer(value => Math.round(value * 1000000) / 1000000),

    body("edges")
      .isArray({ min: 0, max: 100000 })
      .withMessage("Edges array required (max 100000)"),

    body("edges.*.from")
      .isString()
      .trim()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid edge source ID"),

    body("edges.*.to")
      .isString()
      .trim()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid edge target ID"),

    body("edges.*.weight")
      .optional()
      .isFloat({ min: 0, max: 1000000 })
      .toFloat()
      .customSanitizer(value => Math.round(value * 100) / 100),
  ],

  // File upload validation
  fileUpload: [
    body("filename")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .matches(/^[a-zA-Z0-9._\s-]+$/)
      .withMessage("Invalid filename (alphanumeric, dots, dashes, spaces only)"),

    body("size")
      .optional()
      .isInt({ min: 0, max: 500 * 1024 * 1024 }) // 500MB
      .withMessage("File size must be 0-500MB"),

    body("mimetype")
      .optional()
      .isString()
      .matches(/^[a-z]+\/[a-z0-9+.-]+$/)
      .withMessage("Invalid MIME type"),
  ],

  // Search query validation
  search: [
    query("q")
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage("Search query must be 1-500 characters"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be 1-1000"),

    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be >= 0"),
  ],

  // ID validation (generic)
  id: [
    param("id")
      .isString()
      .trim()
      .isLength({ min: 1, max: 64 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid ID format"),
  ],
};

/**
 * Middleware que valida rate limit de payload para evitar DoS
 */
export const validatePayloadRate = (
  maxPayloadMb: number = 50
) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.body) {
    return next();
  }
  const payloadSize = JSON.stringify(req.body).length / (1024 * 1024);

  if (payloadSize > maxPayloadMb) {
    logger.warn("Payload exceeds configured limit", {
      ip: req.ip,
      sizeMb: payloadSize.toFixed(2),
      maxMb: maxPayloadMb,
      path: req.path,
    });

    return res.status(413).json({
      error: "Payload too large",
      code: "PAYLOAD_TOO_LARGE",
      details: { maxMb: maxPayloadMb, providedMb: payloadSize.toFixed(2) },
    });
  }

  next();
};

/**
 * Middleware que calcula fingerprint de request para detecção de replay
 */
export const attachRequestFingerprint = (req: Request, res: Response, next: NextFunction) => {
  const fingerprint = createHash('sha256')
    .update(`${req.ip}${req.headers['user-agent']}${req.method}${req.path}`)
    .digest('hex');

  res.locals.requestFingerprint = fingerprint;
  res.setHeader('X-Request-Fingerprint', fingerprint);

  next();
};
