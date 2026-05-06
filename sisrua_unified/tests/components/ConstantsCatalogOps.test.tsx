import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ConstantsCatalogOps from "../../src/components/ConstantsCatalogOps";

vi.mock("../../src/services/constantsCatalogService", () => ({
  fetchCatalogSnapshots: vi.fn().mockResolvedValue({
    snapshots: [
      {
        id: 7,
        namespace: "bt",
        entryCount: 42,
        createdAt: "2026-04-22T12:34:56.000Z",
      },
    ],
  }),
  fetchConstantsRefreshEvents: vi.fn().mockResolvedValue({
    events: [
      {
        actor: "qa-bot",
        createdAt: "2026-04-22T12:34:56.000Z",
        durationMs: 210,
        httpStatus: 200,
        success: true,
      },
    ],
  }),
  fetchConstantsCatalogStatus: vi.fn().mockResolvedValue({
    flags: { bt: true, mt: false },
    lastRefreshEvent: {
      actor: "qa-bot",
      createdAt: "2026-04-22T12:34:56.000Z",
      durationMs: 210,
    },
  }),
  fetchConstantsRefreshStats: vi.fn().mockResolvedValue({
    totalRefreshes: 3,
    successRate: 100,
    successCount: 3,
    avgDurationMs: 180,
    maxDurationMs: 210,
    lastSuccessAt: "2026-04-22T12:34:56.000Z",
    namespaceFrequency: { bt: 3 },
  }),
  refreshConstantsCatalog: vi.fn().mockResolvedValue(undefined),
  restoreCatalogSnapshot: vi.fn().mockResolvedValue({
    restoredSnapshotId: 7,
    namespace: "bt",
    entryCount: 42,
  }),
}));

describe("ConstantsCatalogOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza cópia em inglês e formata data pelo locale", async () => {
    render(<ConstantsCatalogOps locale="en-US" />);

    await waitFor(() => {
      expect(screen.getByText("Constants Catalog")).toBeInTheDocument();
    });

    expect(screen.getByText("Active namespaces:")).toBeInTheDocument();
    expect(screen.getByText("Recent History")).toBeInTheDocument();
    expect(screen.getByText("Snapshots")).toBeInTheDocument();
    expect(
      screen.getAllByText(/4\/22\/2026|04\/22\/2026/).length,
    ).toBeGreaterThan(0);
  });

  it("renderiza cópia em espanhol", async () => {
    render(<ConstantsCatalogOps locale="es-ES" />);

    await waitFor(() => {
      expect(screen.getByText("Historial Reciente")).toBeInTheDocument();
    });

    expect(screen.getByText("Namespaces activos:")).toBeInTheDocument();
    expect(screen.getByText("Estadisticas de Refresh")).toBeInTheDocument();
    expect(screen.getByText("Restaurar")).toBeInTheDocument();
  });
});
