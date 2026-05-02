/**
 * SidebarAnalysisResults.test.tsx — Vitest: teste dos resultados de análise na barra lateral.
 * Verifica renderização de dashboards, erros e botões de exportação.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SidebarAnalysisResults } from "../../src/components/SidebarAnalysisResults";

const DEFAULT_PROPS: any = {
  locale: "pt-BR",
  osmData: null,
  stats: null,
  analysisText: "",
  terrainData: null,
  error: null,
  handleDownloadDxf: vi.fn(),
  handleDownloadCoordinatesCsv: vi.fn(),
  isDownloading: false,
  showToast: vi.fn(),
};

describe("SidebarAnalysisResults", () => {
  it("deve renderizar mensagem de erro se houver falha", () => {
    render(<SidebarAnalysisResults {...DEFAULT_PROPS} error="Falha na análise" />);
    expect(screen.getByText(/falha na análise/i)).toBeInTheDocument();
  });

  it("deve renderizar dashboard se houver dados OSM (verificando placeholders)", () => {
    const stats = { areaName: "Teste", totalPoints: 10, streetCount: 2 };
    render(<SidebarAnalysisResults {...DEFAULT_PROPS} osmData={{}} stats={stats} />);
    // O componente principal exibe os botões de exportação quando tem dados
    expect(screen.getByRole("button", { name: /dxf/i })).toBeInTheDocument();
  });

  it("deve exibir botões de exportação se houver dados", () => {
    const stats = { areaName: "Teste", totalPoints: 10, streetCount: 2 };
    render(<SidebarAnalysisResults {...DEFAULT_PROPS} osmData={{}} stats={stats} />);
    expect(screen.getByRole("button", { name: /dxf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv/i })).toBeInTheDocument();
  });
});
