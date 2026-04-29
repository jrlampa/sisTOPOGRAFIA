import { jest } from "@jest/globals";

// Mock do config ANTES de importar o serviço
jest.unstable_mockModule("../config.js", () => ({
  config: {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  },
}));

// Mock do postgres
const mockUnsafe = jest.fn();
const mockSql = Object.assign(jest.fn(), { unsafe: mockUnsafe });
jest.unstable_mockModule("postgres", () => ({
  __esModule: true,
  default: jest.fn(() => mockSql),
}));

// Importações dinâmicas após os mocks
const { DbMaintenanceService } = await import("../services/dbMaintenanceService.js");

describe("DbMaintenanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sanitizeFailedDxfTasks", () => {
    it("should classify and process tasks correctly", async () => {
      const mockTasks = [
        { task_id: "1", error: "missing required parameters", payload: {} },
        { task_id: "2", error: "python script failed to spawn", payload: { lat: -23, lon: -46, radius: 100 } },
        { task_id: "3", error: "unknown error", payload: { lat: -23, lon: -46, radius: 100 } }
      ];

      mockUnsafe.mockResolvedValueOnce(mockTasks);
      mockSql.mockResolvedValue({});

      const result = await DbMaintenanceService.sanitizeFailedDxfTasks(10);

      expect(result.processed).toBe(3);
      expect(result.cancelled).toBe(1);
      expect(result.requeued).toBe(1);
    });

    it("should handle empty task list", async () => {
      mockUnsafe.mockResolvedValueOnce([]);
      const result = await DbMaintenanceService.sanitizeFailedDxfTasks(10);
      expect(result.processed).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.requeued).toBe(0);
    });
  });
});
