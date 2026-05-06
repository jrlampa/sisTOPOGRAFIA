import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { SettingsModalProjectTab } from "../../src/components/settings/SettingsModalProjectTab";

describe("SettingsModalProjectTab", () => {
  const baseProps = {
    fileInputRef: { current: null },
    onSaveProject: vi.fn(),
    onLoadProject: vi.fn(),
    setBtProjectType: vi.fn(),
    setBtEditorMode: vi.fn(),
    setBtTransformerCalculationMode: vi.fn(),
    setBtQtPontoCalculationMethod: vi.fn(),
    setBtCqtPowerFactor: vi.fn(),
    setClandestinoAreaM2: vi.fn(),
    updateMetadata: vi.fn(),
  };

  it("renderiza cópia em inglês quando locale=en-US", () => {
    render(
      <SettingsModalProjectTab
        {...baseProps}
        settings={{ ...INITIAL_APP_STATE.settings, locale: "en-US" }}
      />,
    );

    expect(screen.getByText("Save Project")).toBeInTheDocument();
    expect(screen.getByText("Project Name")).toBeInTheDocument();
    expect(screen.getByText("LV Network Topology")).toBeInTheDocument();
    expect(screen.getByText("Map Editing Mode")).toBeInTheDocument();
    expect(screen.getByText("Transformer Calculation")).toBeInTheDocument();
  });

  it("renderiza cópia em espanhol quando locale=es-ES", () => {
    render(
      <SettingsModalProjectTab
        {...baseProps}
        settings={{ ...INITIAL_APP_STATE.settings, locale: "es-ES" }}
      />,
    );

    expect(screen.getByText("Guardar Proyecto")).toBeInTheDocument();
    expect(screen.getByText("Nombre del Proyecto")).toBeInTheDocument();
    expect(screen.getByText("Topología Red BT")).toBeInTheDocument();
    expect(screen.getByText("Modo de Edición en el Mapa")).toBeInTheDocument();
    expect(
      screen.getByText("Cálculo de los Transformadores"),
    ).toBeInTheDocument();
  });
});
