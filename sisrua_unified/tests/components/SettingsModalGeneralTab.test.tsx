import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { SettingsModalGeneralTab } from "../../src/components/settings/SettingsModalGeneralTab";

vi.mock("../../src/components/ConstantsCatalogOps", () => ({
  default: () => React.createElement("div", { "data-testid": "constants-catalog-ops" }),
}));

describe("SettingsModalGeneralTab", () => {
  const baseProps = {
    onUpdateSettings: vi.fn(),
    setSimplification: vi.fn(),
    toggleTheme: vi.fn(),
    setProjection: vi.fn(),
    setMapProvider: vi.fn(),
    setContourRenderMode: vi.fn(),
    toggleLayer: vi.fn(),
  };

  it("renderiza cópia em inglês quando locale=en-US", () => {
    render(
      <SettingsModalGeneralTab
        {...baseProps}
        settings={{ ...INITIAL_APP_STATE.settings, locale: "en-US" }}
      />,
    );

    expect(screen.getByText("Interface & Map")).toBeInTheDocument();
    expect(screen.getByText("Vector Map")).toBeInTheDocument();
    expect(screen.getByText("Interface language")).toBeInTheDocument();
    expect(screen.getByText("DXF Layers")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renderiza cópia em espanhol quando locale=es-ES", () => {
    render(
      <SettingsModalGeneralTab
        {...baseProps}
        settings={{ ...INITIAL_APP_STATE.settings, locale: "es-ES" }}
      />,
    );

    expect(screen.getByText("Interfaz y Mapa")).toBeInTheDocument();
    expect(screen.getByText("Mapa Vectorial")).toBeInTheDocument();
    expect(screen.getByText("Idioma de la interfaz")).toBeInTheDocument();
    expect(screen.getByText("Capas DXF")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });
});