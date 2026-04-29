import { vi } from "vitest";
import * as dbClientModule from "../repositories/dbClient.js";
import { getSystemHealthMvsReport } from "../services/systemHealthDashboardService.js";

describe("SystemHealthDashboardService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve retornar null se o dbClient estiver indisponível", async () => {
    vi.spyOn(dbClientModule, "getDbClient").mockReturnValue(null as any);
    const report = await getSystemHealthMvsReport();
    expect(report).toBeNull();
  });

  it("deve retornar o relatório consolidado quando o banco está disponível", async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{ day_local: "2026-04-28", export_count: 10 }]) // btHistory
      .mockResolvedValueOnce([{ table_name: "jobs", event_count: 50 }])      // auditStats
      .mockResolvedValueOnce([{ namespace: "poles", total_entries: 100 }]);   // catalogSummary

    vi.spyOn(dbClientModule, "getDbClient").mockReturnValue(mockSql as any);

    const report = await getSystemHealthMvsReport();

    expect(report).not.toBeNull();
    expect(report?.btHistory).toHaveLength(1);
    expect(report?.auditStats).toHaveLength(1);
    expect(report?.catalogSummary).toHaveLength(1);
    expect(report?.timestamp).toBeDefined();
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("deve retornar null e logar erro se uma query falhar", async () => {
    const mockSql = vi.fn().mockRejectedValue(new Error("DB Error"));
    vi.spyOn(dbClientModule, "getDbClient").mockReturnValue(mockSql as any);

    const report = await getSystemHealthMvsReport();
    expect(report).toBeNull();
  });
});

