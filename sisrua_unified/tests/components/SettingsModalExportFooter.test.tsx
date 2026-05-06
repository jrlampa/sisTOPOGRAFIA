import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsModalExportFooter } from "../../src/components/settings/SettingsModalExportFooter";

describe("SettingsModalExportFooter", () => {
  it("renderiza mensagem desabilitada em inglês quando não há dados", () => {
    render(
      <SettingsModalExportFooter
        locale="en-US"
        hasData={false}
        exportMemorialPdfWithDxf={false}
        onToggleExportMemorialPdfWithDxf={vi.fn()}
      />,
    );

    expect(screen.getByText("Export Results")).toBeInTheDocument();
    expect(
      screen.getByText("Run an analysis first to enable export."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generate descriptive memorial PDF with DXF"),
    ).toBeInTheDocument();
  });

  it("renderiza ações de exportação em espanhol quando há dados", () => {
    render(
      <SettingsModalExportFooter
        locale="es-ES"
        hasData
        exportMemorialPdfWithDxf={false}
        onToggleExportMemorialPdfWithDxf={vi.fn()}
        onExportGeoJSON={vi.fn()}
        onExportDxf={vi.fn()}
      />,
    );

    expect(screen.getByText("Exportar Resultados")).toBeInTheDocument();
    expect(screen.getByText("GeoJSON")).toBeInTheDocument();
    expect(screen.getByText("DXF (CAD)")).toBeInTheDocument();
  });

  it("aciona callback ao alternar memorial PDF", () => {
    const onToggle = vi.fn();

    render(
      <SettingsModalExportFooter
        locale="pt-BR"
        hasData
        exportMemorialPdfWithDxf={false}
        onToggleExportMemorialPdfWithDxf={onToggle}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Gerar memorial descritivo em PDF junto com DXF",
      }),
    );

    expect(onToggle).toHaveBeenCalledWith(true);
  });
});