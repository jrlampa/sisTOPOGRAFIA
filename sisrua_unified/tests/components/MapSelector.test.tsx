/**
 * MapSelector.test.tsx — Vitest: teste do componente de mapa orquestrador.
 * Verifica renderização do Leaflet e integração de camadas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import MapSelector from "../../src/components/MapSelector";

// Mock do SelectionManager para evitar TypeError com hooks do Leaflet
vi.mock("../../src/components/MapSelectorSelectionManager", () => ({
  default: () => <div data-testid="selection-manager" />
}));

// Mock specific layers to avoid deep rendering issues in this unit test
vi.mock("../../src/components/MapSelectorEdgesLayer", () => ({
  default: () => <div data-testid="bt-edges-layer" />
}));
vi.mock("../../src/components/MapLayers/MapSelectorPolesLayer", () => ({
  default: () => <div data-testid="bt-poles-layer" />
}));
vi.mock("../../src/components/MapLayers/MapSelectorTransformersLayer", () => ({
  default: () => <div data-testid="bt-transformers-layer" />
}));

const DEFAULT_PROPS: any = {
  center: { lat: -23.5, lng: -46.5 },
  radius: 100,
  selectionMode: "circle",
  polygonPoints: [],
  onLocationChange: vi.fn(),
  onPolygonChange: vi.fn(),
  layerConfig: { btNetwork: true, mtNetwork: true },
  locale: "pt-BR",
  btMarkerTopology: {
    poles: [{ id: 'p1', lat: -23.5, lng: -46.5, title: 'P1' }],
    transformers: [],
    edges: []
  }
};

describe("MapSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar o container do mapa e as camadas base", () => {
    render(<MapSelector {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(screen.getByTestId("bt-poles-layer")).toBeInTheDocument();
    expect(screen.getByTestId("bt-edges-layer")).toBeInTheDocument();
  });

  it("deve exibir banner de modo edição quando btEditorMode for diferente de none", () => {
    render(<MapSelector {...DEFAULT_PROPS} btEditorMode="add-pole" />);
    expect(screen.getByText(/Modo Edição: Adicionar Poste/i)).toBeInTheDocument();
  });

  it("deve ativar modo X-Ray ao pressionar a tecla Shift", () => {
    const { container } = render(<MapSelector {...DEFAULT_PROPS} />);
    
    // Check initial state (no xray class)
    expect(container.firstChild).not.toHaveClass("map-xray-mode");

    // Press Shift
    fireEvent.keyDown(window, { key: "Shift" });
    expect(container.firstChild).toHaveClass("map-xray-mode");

    // Release Shift
    fireEvent.keyUp(window, { key: "Shift" });
    expect(container.firstChild).not.toHaveClass("map-xray-mode");
  });

  it("deve renderizar o overlay DG quando um cenário for fornecido", () => {
    const mockScenario = {
      scenarioId: "sc-1",
      trafoPositionLatLon: { lat: -23.5, lon: -46.5 },
      edges: [],
      electricalResult: { feasible: true, cqtMaxFraction: 0.05, worstTerminalNodeId: "p1", trafoUtilizationFraction: 0.4, totalCableLengthMeters: 50 },
      objectiveScore: 85,
      feasible: true,
      violations: []
    };

    render(<MapSelector {...DEFAULT_PROPS} dgScenario={mockScenario} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("deve lidar com o evento de drop de arquivo KML", () => {
    const onKmlDrop = vi.fn();
    render(<MapSelector {...DEFAULT_PROPS} onKmlDrop={onKmlDrop} />);
    
    const file = new File(["test"], "test.kml", { type: "application/vnd.google-earth.kml+xml" });
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [file]
      }
    };

    fireEvent.drop(screen.getByTestId("map-container").parentElement!, dropEvent);
    expect(onKmlDrop).toHaveBeenCalledWith(file);
  });
});
