/**
 * server/middleware/authGuard.ts
 *
 * Middleware de autorização para proteger rotas críticas.
 * Suporta Bearer token via header Authorization.
 */

import { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  extractSupabaseRoleClaim,
  extractSupabaseTenantId,
  isLikelyJwt,
  isSupabaseAuthConfigured,
  type SupabaseJwtPayload,
  verifySupabaseAccessToken,
} from "../services/supabaseJwtService.js";

function hasSupabaseAdminAccess(res: Response): boolean {
  const locals = (res.locals ?? {}) as {
    authenticatedUser?: { email?: string | null; payload?: SupabaseJwtPayload };
  };

  const authenticatedUser = locals.authenticatedUser as
    | { email?: string | null; payload?: SupabaseJwtPayload }
    | undefined;

  if (!authenticatedUser?.payload) {
    return false;
  }

  const email = authenticatedUser.email?.toLowerCase() ?? "";
  const superadminEmail = config.SUPABASE_SUPERADMIN_EMAIL?.toLowerCase();
  if (superadminEmail && email === superadminEmail) {
    return true;
  }

  const payloadRole =
    typeof authenticatedUser.payload.role === "string"
      ? authenticatedUser.payload.role.toLowerCase()
      : "";
  const appMetadataRole =
    typeof authenticatedUser.payload.app_metadata?.role === "string"
      ? String(authenticatedUser.payload.app_metadata.role).toLowerCase()
      : "";
  const userMetadataRole =
    typeof authenticatedUser.payload.user_metadata?.role === "string"
      ? String(authenticatedUser.payload.user_metadata.role).toLowerCase()
      : "";

  const allowedRoles = new Set([
    "admin",
    "superadmin",
    "service_role",
    "supabase_admin",
  ]);

  return (
    allowedRoles.has(payloadRole) ||
    allowedRoles.has(appMetadataRole) ||
    allowedRoles.has(userMetadataRole)
  );
}

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
  next: NextFunction,
) => {
  if (hasSupabaseAdminAccess(res)) {
    logger.debug("[AuthGuard] Supabase admin access granted", {
      path: req.path,
      userId: res.locals.userId,
      userEmail: res.locals.userEmail,
    });
    return next();
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!config.ADMIN_TOKEN) {
    if (config.NODE_ENV === "production") {
      logger.error("[AuthGuard] ADMIN_TOKEN missing in production", {
        path: req.path,
        ip: req.ip,
      });
      return res.status(503).json({
        error: "Service unavailable",
        code: "SECURITY_MISCONFIGURATION",
        message: "Protected endpoint is not configured",
      });
    }

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
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!config.METRICS_TOKEN) {
    if (config.NODE_ENV === "production") {
      logger.error("[AuthGuard] METRICS_TOKEN missing in production", {
        path: req.path,
        ip: req.ip,
      });
      return res.status(503).json({
        error: "Service unavailable",
        code: "SECURITY_MISCONFIGURATION",
        message: "Metrics endpoint is not configured",
      });
    }

    logger.warn(
      "[AuthGuard] METRICS_TOKEN not configured - metrics endpoint is open",
      {
        path: req.path,
        ip: req.ip,
      },
    );
    return next();
  }

  if (!authHeader) {
    res.set("WWW-Authenticate", 'Bearer realm="metrics"');
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
  next: NextFunction,
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (token) {
    res.locals.authenticated = true;
    res.locals.token = token;
  }

  next();
};

/**
 * Verifica JWTs do Supabase quando presentes e popula o contexto confiável.
 * Tokens não-JWT continuam disponíveis para fluxos legados baseados em bearer fixo.
 */
export const attachSupabaseUserIfPresent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!token || !isLikelyJwt(token) || !isSupabaseAuthConfigured()) {
    return next();
  }

  try {
    const verifiedUser = await verifySupabaseAccessToken(token);
    if (!verifiedUser) {
      return next();
    }

    res.locals.authenticated = true;
    res.locals.token = token;
    res.locals.userId = verifiedUser.userId;
    res.locals.userEmail = verifiedUser.email;
    res.locals.authenticatedUser = verifiedUser;
    res.locals.supabaseRoleClaim = extractSupabaseRoleClaim(
      verifiedUser.payload,
    );
    const supabaseTenantId = extractSupabaseTenantId(verifiedUser.payload);
    if (supabaseTenantId) {
      res.locals.tenantId = supabaseTenantId;
    }
    return next();
  } catch (error) {
    logger.warn("[AuthGuard] Invalid Supabase bearer token", {
      path: req.path,
      ip: req.ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(401).json({
      error: "Unauthorized",
      code: "INVALID_TOKEN",
      message: "Supabase session is invalid or expired",
    });
  }
};

/**
 * Middleware que permite skipping de auth em development/test
 */
export const skipAuthInDev = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (config.NODE_ENV !== "production") {
    logger.debug("[AuthGuard] Skipping auth in non-production", {
      env: config.NODE_ENV,
    });
    return next();
  }

  // Em produção, usar requireAdminToken
  return requireAdminToken(req, res, next);
};
