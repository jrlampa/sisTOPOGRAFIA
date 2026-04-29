import { jest } from "@jest/globals";
import * as dbClientModule from "../repositories/dbClient.js";
import { getSystemHealthMvsReport } from "../services/systemHealthDashboardService.js";

describe("SystemHealthDashboardService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deve retornar null se o dbClient estiver indisponível", async () => {
    jest.spyOn(dbClientModule, "getDbClient").mockReturnValue(null as any);
    const report = await getSystemHealthMvsReport();
    expect(report).toBeNull();
  });

  it("deve retornar o relatório consolidado quando o banco está disponível", async () => {
    const mockSql = jest.fn()
      .mockResolvedValueOnce([{ day_local: "2026-04-28", export_count: 10 }]) // btHistory
      .mockResolvedValueOnce([{ table_name: "jobs", event_count: 50 }])      // auditStats
      .mockResolvedValueOnce([{ namespace: "poles", total_entries: 100 }]);   // catalogSummary

    jest.spyOn(dbClientModule, "getDbClient").mockReturnValue(mockSql as any);

    const report = await getSystemHealthMvsReport();

    expect(report).not.toBeNull();
    expect(report?.btHistory).toHaveLength(1);
    expect(report?.auditStats).toHaveLength(1);
    expect(report?.catalogSummary).toHaveLength(1);
    expect(report?.timestamp).toBeDefined();
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("deve retornar null e logar erro se uma query falhar", async () => {
    const mockSql = jest.fn().mockRejectedValue(new Error("DB Error"));
    jest.spyOn(dbClientModule, "getDbClient").mockReturnValue(mockSql as any);

    const report = await getSystemHealthMvsReport();
    expect(report).toBeNull();
  });
});
