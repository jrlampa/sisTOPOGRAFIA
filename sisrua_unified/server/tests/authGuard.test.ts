import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    NODE_ENV: "test",
    ADMIN_TOKEN: undefined as string | undefined,
    METRICS_TOKEN: undefined as string | undefined,
  },
}));

vi.mock("../config.js", () => ({
  config: mockConfig,
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { requireAdminToken, requireMetricsToken } from "../middleware/authGuard";

describe("authGuard hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.NODE_ENV = "test";
    mockConfig.ADMIN_TOKEN = undefined;
    mockConfig.METRICS_TOKEN = undefined;
  });

  it("allows admin route in non-production when token is absent", () => {
    const req: any = { headers: {}, path: "/api/admin", ip: "127.0.0.1" };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAdminToken(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("fails closed for admin route in production when token is absent", () => {
    mockConfig.NODE_ENV = "production";

    const req: any = { headers: {}, path: "/api/admin", ip: "203.0.113.10" };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAdminToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SECURITY_MISCONFIGURATION" }),
    );
  });

  it("fails closed for metrics route in production when token is absent", () => {
    mockConfig.NODE_ENV = "production";

    const req: any = { headers: {}, path: "/metrics", ip: "203.0.113.10" };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireMetricsToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SECURITY_MISCONFIGURATION" }),
    );
  });
});