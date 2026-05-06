import { vi } from "vitest";

// Vitest v4 não expõe `vi.unstable_mockModule` aqui.
// Fazemos mocks via `vi.doMock` + import dinâmico por teste.
const mockUnsafe = vi.fn();
const mockSql = Object.assign(vi.fn(), { unsafe: mockUnsafe });

async function loadService() {
  vi.doMock("../config.js", () => ({
    config: {
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    },
  }));
  vi.doMock("postgres", () => ({
    __esModule: true,
    default: vi.fn(() => mockSql),
  }));
  return import("../services/dbMaintenanceService.js") as Promise<
    typeof import("../services/dbMaintenanceService")
  >;
}

describe("DbMaintenanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("sanitizeFailedDxfTasks", () => {
    it("should classify and process tasks correctly", async () => {
      const { DbMaintenanceService } = await loadService();
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
      const { DbMaintenanceService } = await loadService();
      mockUnsafe.mockResolvedValueOnce([]);
      const result = await DbMaintenanceService.sanitizeFailedDxfTasks(10);
      expect(result.processed).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.requeued).toBe(0);
    });
  });
});

