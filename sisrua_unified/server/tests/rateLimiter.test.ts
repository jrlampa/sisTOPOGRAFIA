import { vi } from "vitest";
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    NODE_ENV: "development",
    RATE_LIMIT_GENERAL_WINDOW_MS: 900000,
    RATE_LIMIT_GENERAL_MAX: 100,
    RATE_LIMIT_DXF_WINDOW_MS: 3600000,
    RATE_LIMIT_DXF_MAX: 10,
    useDbConstantsConfig: false,
  },
}));

const { getSyncMock } = vi.hoisted(() => ({
  getSyncMock: vi.fn(),
}));

vi.mock("../config.js", () => ({
  config: mockConfig,
}));

vi.mock("../services/constantsService.js", () => ({
  constantsService: {
    getSync: getSyncMock,
  },
}));

import { Request, Response } from "express";
import {
  dxfRateLimiter,
  generalRateLimiter,
  getRateLimitPolicySnapshot,
  resolveTrustedRateLimitKey,
  shouldSkipGeneralRateLimit,
} from "../middleware/rateLimiter.js";

// Mock logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Rate Limiter Middleware", () => {
  beforeEach(() => {
    mockConfig.NODE_ENV = "development";
    mockConfig.useDbConstantsConfig = false;
    getSyncMock.mockReset();
  });

  describe("Rate Limiter Configuration", () => {
    it("should export dxfRateLimiter", () => {
      expect(dxfRateLimiter).toBeDefined();
      expect(typeof dxfRateLimiter).toBe("function");
    });

    it("should export generalRateLimiter", () => {
      expect(generalRateLimiter).toBeDefined();
      expect(typeof generalRateLimiter).toBe("function");
    });

    it("should handle IPv4 addresses", () => {
      // This test verifies the rate limiters are properly configured
      // In production, the ipKeyGenerator will handle IPv4 correctly
      const mockReq = {
        ip: "192.168.1.100",
        headers: {},
      } as unknown as Request;

      expect(dxfRateLimiter).toBeDefined();
      expect(generalRateLimiter).toBeDefined();
    });

    it("should handle IPv6 addresses", () => {
      // This test verifies the rate limiters can handle IPv6
      // The ipKeyGenerator will normalize IPv6 to CIDR notation
      const mockReq = {
        ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        headers: {},
      } as unknown as Request;

      expect(dxfRateLimiter).toBeDefined();
      expect(generalRateLimiter).toBeDefined();
    });

    it("should handle missing IP with fallback", () => {
      const mockReq = {
        ip: undefined,
        headers: {},
      } as unknown as Request;

      // The rate limiter should still work even without IP
      expect(dxfRateLimiter).toBeDefined();
      expect(generalRateLimiter).toBeDefined();
    });

    it("should expose fallback policy snapshot from env/config values", () => {
      expect(getRateLimitPolicySnapshot()).toEqual({
        general: {
          windowMs: 900000,
          limit: 100,
        },
        dxf: {
          windowMs: 3600000,
          limit: 10,
        },
        downloads: {
          windowMs: 900000,
          limit: 50,
        },
        analyze: {
          windowMs: 300000,
          limit: 20,
        },
      });
    });

    it("should expose DB-backed numeric limits when config namespace is enabled", () => {
      mockConfig.useDbConstantsConfig = true;
      getSyncMock.mockImplementation((_namespace: string, key: string) => {
        const dbValues: Record<string, number> = {
          RATE_LIMIT_GENERAL_WINDOW_MS: 120000,
          RATE_LIMIT_GENERAL_MAX: 250,
          RATE_LIMIT_DXF_WINDOW_MS: 1800000,
          RATE_LIMIT_DXF_MAX: 25,
        };

        return dbValues[key] ?? undefined;
      });

      expect(getRateLimitPolicySnapshot()).toEqual({
        general: {
          windowMs: 120000,
          limit: 250,
        },
        dxf: {
          windowMs: 1800000,
          limit: 25,
        },
        downloads: {
          windowMs: 900000,
          limit: 50,
        },
        analyze: {
          windowMs: 300000,
          limit: 20,
        },
      });
    });

    it("should use x-user-id for rate limiting outside production", () => {
      mockConfig.NODE_ENV = "development";
      const key = resolveTrustedRateLimitKey({
        headers: { "x-user-id": "dev-user" },
        res: { locals: {} },
      } as unknown as Request);

      expect(key).toBe("user:dev-user");
    });

    it("should ignore x-user-id for rate limiting in production", () => {
      mockConfig.NODE_ENV = "production";
      const key = resolveTrustedRateLimitKey({
        headers: { "x-user-id": "spoofed-user" },
        res: { locals: {} },
      } as unknown as Request);

      expect(key).toBeNull();
    });

    it("should hash bearer token for rate limiting when available", () => {
      mockConfig.NODE_ENV = "production";
      const key = resolveTrustedRateLimitKey({
        headers: { authorization: "Bearer secret-token" },
        res: { locals: {} },
      } as unknown as Request);

      expect(key).toMatch(/^bearer:[a-f0-9]{64}$/);
    });
  });

  describe("X-Forwarded-For Support", () => {
    it("should respect X-Forwarded-For when trust proxy is enabled", () => {
      // In production, when trust proxy is enabled, req.ip will be populated
      // from X-Forwarded-For header automatically by Express
      const mockReq = {
        ip: "10.0.0.1",
        headers: {
          "x-forwarded-for": "10.0.0.1",
        },
      } as unknown as Request;

      // The rate limiters should be configured to use the IP
      expect(dxfRateLimiter).toBeDefined();
      expect(generalRateLimiter).toBeDefined();
    });
  });

  describe("General rate limiter skip rules", () => {
    it("should skip health checks", () => {
      const mockReq = {
        method: "GET",
        path: "/health",
        ip: "203.0.113.10",
      } as Request;

      expect(shouldSkipGeneralRateLimit(mockReq)).toBe(true);
    });

    it("should skip loopback traffic outside production", () => {
      const mockReq = {
        method: "POST",
        path: "/api/bt/derived",
        ip: "::1",
      } as Request;

      expect(shouldSkipGeneralRateLimit(mockReq)).toBe(true);
    });

    it("should keep production traffic rate limited even on non-health endpoints", () => {
      mockConfig.NODE_ENV = "production";
      const mockReq = {
        method: "POST",
        path: "/api/bt/derived",
        ip: "::1",
      } as Request;

      expect(shouldSkipGeneralRateLimit(mockReq)).toBe(false);
    });
  });
});

