import { jest } from "@jest/globals";

// Mock dependencies
jest.mock("../repositories/dbClient.js", () => ({
  getDbClient: jest.fn(),
  isDbAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock("../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { 
  upsertServiceProfile, 
  listServiceProfiles,
  removeServiceProfile,
} from "../services/tenantServiceProfileService.js";
import { getDbClient } from "../repositories/dbClient.js";

describe("tenantServiceProfileService", () => {
  const mockSql = jest.fn() as any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    (getDbClient as jest.Mock).mockReturnValue(mockSql);
    mockSql.mockImplementation(() => Promise.resolve([]));
  });

  describe("Validation and Normalization", () => {
    it("should throw if tenantId is invalid", async () => {
      // Use valid format but invalid tenantId logic (empty or contains ..)
      await expect(upsertServiceProfile({
        tenantId: "",
        serviceCode: "test",
        serviceName: "Test",
        tier: "bronze",
        slaAvailabilityPct: 99,
        sloLatencyP95Ms: 100,
        supportChannel: "slack",
        supportHours: "24/7",
        escalationPolicy: {},
        metadata: {},
      })).rejects.toThrow("tenantId inválido");
    });

    it("should throw if serviceCode is invalid", async () => {
      await expect(upsertServiceProfile({
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        serviceCode: "Invalid Code!",
        serviceName: "Test",
        tier: "bronze",
        slaAvailabilityPct: 99,
        sloLatencyP95Ms: 100,
        supportChannel: "slack",
        supportHours: "24/7",
        escalationPolicy: {},
        metadata: {},
      })).rejects.toThrow("serviceCode inválido");
    });

    it("should throw if slaAvailabilityPct is out of range", async () => {
      await expect(upsertServiceProfile({
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        serviceCode: "test",
        serviceName: "Test",
        tier: "bronze",
        slaAvailabilityPct: 50,
        sloLatencyP95Ms: 100,
        supportChannel: "slack",
        supportHours: "24/7",
        escalationPolicy: {},
        metadata: {},
      })).rejects.toThrow("slaAvailabilityPct fora do intervalo permitido");
    });
  });

  describe("Operations", () => {
    it("should call getDbClient and execute query for upsert", async () => {
      mockSql.mockResolvedValueOnce([{ id: "1" }]);
      
      const result = await upsertServiceProfile({
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        serviceCode: "test",
        serviceName: "Test",
        tier: "gold",
        slaAvailabilityPct: 99.9,
        sloLatencyP95Ms: 50,
        supportChannel: "email",
        supportHours: "9-18",
        escalationPolicy: {},
        metadata: {},
      });

      expect(getDbClient).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should fetch profiles for a tenant", async () => {
      mockSql.mockResolvedValueOnce([{ id: "1", service_code: "test", sla_availability_pct: 99, slo_latency_p95_ms: 100, is_active: true }]);
      
      const results = await listServiceProfiles("550e8400-e29b-41d4-a716-446655440000");
      
      expect(results).toHaveLength(1);
      expect(results[0].serviceCode).toBe("test");
    });

    it("should delete a profile", async () => {
      mockSql.mockResolvedValueOnce(["row"]);
      
      const removed = await removeServiceProfile("550e8400-e29b-41d4-a716-446655440000", "code1");
      
      expect(removed).toBe(true);
      expect(mockSql).toHaveBeenCalled();
    });
  });
});
