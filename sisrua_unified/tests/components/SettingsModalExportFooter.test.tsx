import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsModalExportFooter } from "../../src/components/settings/SettingsModalExportFooter";

describe("SettingsModalExportFooter", () => {
  it("renderiza mensagem desabilitada em inglês quando não há dados", () => {
    render(<SettingsModalExportFooter locale="en-US" hasData={false} />);

    expect(screen.getByText("Export Results")).toBeInTheDocument();
    expect(
      screen.getByText("Run an analysis first to enable export."),
    ).toBeInTheDocument();
  });

  it("renderiza ações de exportação em espanhol quando há dados", () => {
    render(
      <SettingsModalExportFooter
        locale="es-ES"
        hasData
        onExportGeoJSON={vi.fn()}
        onExportDxf={vi.fn()}
      />,
    );

    expect(screen.getByText("Exportar Resultados")).toBeInTheDocument();
    expect(screen.getByText("GeoJSON")).toBeInTheDocument();
    expect(screen.getByText("DXF (CAD)")).toBeInTheDocument();
  });
});