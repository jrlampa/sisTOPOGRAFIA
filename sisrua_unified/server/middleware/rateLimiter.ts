import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";
import { createHash } from "crypto";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { constantsService } from "../services/constantsService.js";

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const isLoopbackIp = (ip: string | undefined): boolean => {
  if (!ip) {
    return false;
  }

  return LOOPBACK_IPS.has(ip);
};

export const shouldSkipGeneralRateLimit = (req: Request): boolean => {
  if (req.path === "/health") {
    return true;
  }

  if (req.method === "GET" && req.path.startsWith("/api/jobs/")) {
    return true;
  }

  return config.NODE_ENV !== "production" && isLoopbackIp(req.ip);
};

const resolveTrustedRateLimitKey = (req: Request): string | null => {
  const localUserId =
    typeof req.res?.locals?.userId === "string"
      ? req.res.locals.userId.trim()
      : "";
  if (localUserId) {
    return `user:${localUserId}`;
  }

  if (config.NODE_ENV !== "production") {
    const devUserId = req.headers["x-user-id"];
    if (typeof devUserId === "string" && devUserId.trim().length > 0) {
      return `user:${devUserId.trim()}`;
    }
  }

  const authHeader =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.trim()
      : "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (tokenMatch?.[1]) {
    const tokenHash = createHash("sha256")
      .update(tokenMatch[1].trim())
      .digest("hex");
    return `bearer:${tokenHash}`;
  }

  return null;
};

/**
 * Custom key generator that prioritizes trusted identity over IP address.
 * In production, client-controlled x-user-id is ignored.
 */
const keyGenerator = (req: Request): string => {
  const trustedKey = resolveTrustedRateLimitKey(req);
  if (trustedKey) {
    return trustedKey;
  }

  return ipKeyGenerator(req.ip || "unknown");
};

interface RateLimitPolicySnapshot {
  general: {
    windowMs: number;
    limit: number;
  };
  dxf: {
    windowMs: number;
    limit: number;
  };
  downloads: {
    windowMs: number;
    limit: number;
  };
  analyze: {
    windowMs: number;
    limit: number;
  };
}

const getConfigNumberConstant = (key: string, fallback: number): number => {
  if (!config.useDbConstantsConfig) {
    return fallback;
  }

  const value = constantsService.getSync<number>("config", key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const getGeneralWindowMs = (): number =>
  getConfigNumberConstant(
    "RATE_LIMIT_GENERAL_WINDOW_MS",
    config.RATE_LIMIT_GENERAL_WINDOW_MS,
  );
const getGeneralLimit = (): number =>
  getConfigNumberConstant(
    "RATE_LIMIT_GENERAL_MAX",
    config.RATE_LIMIT_GENERAL_MAX,
  );
const getDxfWindowMs = (): number =>
  getConfigNumberConstant(
    "RATE_LIMIT_DXF_WINDOW_MS",
    config.RATE_LIMIT_DXF_WINDOW_MS,
  );
const getDxfLimit = (): number =>
  getConfigNumberConstant("RATE_LIMIT_DXF_MAX", config.RATE_LIMIT_DXF_MAX);
const getDownloadsWindowMs = (): number =>
  getConfigNumberConstant("RATE_LIMIT_DOWNLOADS_WINDOW_MS", 15 * 60 * 1_000);
const getDownloadsLimit = (): number =>
  getConfigNumberConstant("RATE_LIMIT_DOWNLOADS_MAX", 50);
const getAnalyzeWindowMs = (): number =>
  getConfigNumberConstant("RATE_LIMIT_ANALYZE_WINDOW_MS", 5 * 60 * 1_000);
const getAnalyzeLimit = (): number =>
  getConfigNumberConstant("RATE_LIMIT_ANALYZE_MAX", 20);

export const getRateLimitPolicySnapshot = (): RateLimitPolicySnapshot => ({
  general: {
    windowMs: getGeneralWindowMs(),
    limit: getGeneralLimit(),
  },
  dxf: {
    windowMs: getDxfWindowMs(),
    limit: getDxfLimit(),
  },
  downloads: {
    windowMs: getDownloadsWindowMs(),
    limit: getDownloadsLimit(),
  },
  analyze: {
    windowMs: getAnalyzeWindowMs(),
    limit: getAnalyzeLimit(),
  },
});

const createDxfRateLimiter = (windowMs: number) =>
  rateLimit({
    windowMs,
    limit: () => getDxfLimit(),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    message: { error: "Too many DXF requests, please try again later." },
    handler: (req, res, _next, options) => {
      logger.warn("DXF rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        limit: options.limit,
        windowMs: options.windowMs,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

const createGeneralRateLimiter = (windowMs: number) =>
  rateLimit({
    windowMs,
    limit: () => getGeneralLimit(),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: shouldSkipGeneralRateLimit,
    keyGenerator,
    message: { error: "Too many requests, please try again later." },
    handler: (req, res, _next, options) => {
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        limit: options.limit,
        windowMs: options.windowMs,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

const createAnalyzeRateLimiter = (windowMs: number) =>
  rateLimit({
    windowMs,
    limit: () => getAnalyzeLimit(),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    message: {
      error: "Too many AI analysis requests, please try again later.",
    },
    handler: (req, res, _next, options) => {
      logger.warn("Analyze rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        limit: options.limit,
        windowMs: options.windowMs,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

const createDownloadsRateLimiter = (windowMs: number) =>
  rateLimit({
    windowMs,
    limit: () => getDownloadsLimit(),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    message: { error: "Too many download requests, please try again later." },
    handler: (req, res, _next, options) => {
      logger.warn("Download rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        limit: options.limit,
        windowMs: options.windowMs,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

let dxfRateLimiterHandler = createDxfRateLimiter(
  config.RATE_LIMIT_DXF_WINDOW_MS,
);
let generalRateLimiterHandler = createGeneralRateLimiter(
  config.RATE_LIMIT_GENERAL_WINDOW_MS,
);
let analyzeRateLimiterHandler = createAnalyzeRateLimiter(getAnalyzeWindowMs());
let downloadsRateLimiterHandler = createDownloadsRateLimiter(
  getDownloadsWindowMs(),
);

export const refreshRateLimitersFromCatalog = (): void => {
  const policy = getRateLimitPolicySnapshot();
  dxfRateLimiterHandler = createDxfRateLimiter(policy.dxf.windowMs);
  generalRateLimiterHandler = createGeneralRateLimiter(policy.general.windowMs);
  analyzeRateLimiterHandler = createAnalyzeRateLimiter(policy.analyze.windowMs);
  downloadsRateLimiterHandler = createDownloadsRateLimiter(
    policy.downloads.windowMs,
  );
};

const dxfRateLimiter = (
  req: Parameters<typeof dxfRateLimiterHandler>[0],
  res: Parameters<typeof dxfRateLimiterHandler>[1],
  next: Parameters<typeof dxfRateLimiterHandler>[2],
) => dxfRateLimiterHandler(req, res, next);

const generalRateLimiter = (
  req: Parameters<typeof generalRateLimiterHandler>[0],
  res: Parameters<typeof generalRateLimiterHandler>[1],
  next: Parameters<typeof generalRateLimiterHandler>[2],
) => generalRateLimiterHandler(req, res, next);

const analyzeRateLimiter = (
  req: Parameters<typeof analyzeRateLimiterHandler>[0],
  res: Parameters<typeof analyzeRateLimiterHandler>[1],
  next: Parameters<typeof analyzeRateLimiterHandler>[2],
) => analyzeRateLimiterHandler(req, res, next);

const downloadsRateLimiter = (
  req: Parameters<typeof downloadsRateLimiterHandler>[0],
  res: Parameters<typeof downloadsRateLimiterHandler>[1],
  next: Parameters<typeof downloadsRateLimiterHandler>[2],
) => downloadsRateLimiterHandler(req, res, next);

export {
  dxfRateLimiter,
  generalRateLimiter,
  analyzeRateLimiter,
  downloadsRateLimiter,
  resolveTrustedRateLimitKey,
};
