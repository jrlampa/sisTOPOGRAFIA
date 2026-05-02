/**
 * server/middleware/authGuard.ts
 * 
 * Middleware de autorização para proteger rotas críticas.
 * Suporta Bearer token via header Authorization.
 */

import { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware que protege rotas críticas com Bearer token (ADMIN_TOKEN)
 * Se ADMIN_TOKEN não está configurado, a rota fica aberta com aviso.
 * 
 * Uso:
 * app.use("/api/admin", requireAdminToken, adminRoutes);
 */
export const requireAdminToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!config.ADMIN_TOKEN) {
    logger.warn("[AuthGuard] ADMIN_TOKEN not configured - endpoint is open", {
      path: req.path,
      ip: req.ip,
    });
    return next();
  }

  if (!token || token !== config.ADMIN_TOKEN) {
    logger.warn("[AuthGuard] Unauthorized access attempt", {
      path: req.path,
      ip: req.ip,
      hasToken: !!token,
    });
    return res.status(403).json({
      error: "Forbidden",
      code: "FORBIDDEN",
      message: "Valid authorization token required",
    });
  }

  logger.debug("[AuthGuard] Token verified", { path: req.path });
  next();
};

/**
 * Middleware que protege o endpoint /metrics com METRICS_TOKEN
 * Similar a requireAdminToken mas com token separado.
 */
export const requireMetricsToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!config.METRICS_TOKEN) {
    logger.warn("[AuthGuard] METRICS_TOKEN not configured - metrics endpoint is open", {
      path: req.path,
      ip: req.ip,
    });
    return next();
  }

  if (!authHeader) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      message: "Authorization header required",
    });
  }

  if (!token || token !== config.METRICS_TOKEN) {
    logger.warn("[AuthGuard] Unauthorized metrics access", {
      ip: req.ip,
    });
    return res.status(403).json({
      error: "Forbidden",
      code: "FORBIDDEN",
      message: "Valid metrics token required",
    });
  }

  logger.debug("[AuthGuard] Metrics token verified");
  next();
};

/**
 * Middleware opcional para rotas que podem ter autorização condicional
 * Retorna o user_id extraído do token, ou null se não autenticado
 */
export const extractUserFromToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (token) {
    // TODO: Implementar JWT verification aqui se usar JWT
    // Por enquanto, apenas marca como autenticado
    res.locals.authenticated = true;
    res.locals.token = token;
  }

  next();
};

/**
 * Middleware que permite skipping de auth em development/test
 */
export const skipAuthInDev = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (config.NODE_ENV !== "production") {
    logger.debug("[AuthGuard] Skipping auth in non-production", { env: config.NODE_ENV });
    return next();
  }

  // Em produção, usar requireAdminToken
  return requireAdminToken(req, res, next);
};
