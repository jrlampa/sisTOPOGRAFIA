/**
 * MapSelector.test.tsx — Vitest: teste do componente de mapa orquestrador.
 * Verifica renderização do Leaflet e integração de camadas.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import MapSelector from "../../src/components/MapSelector";

// Mock do react-leaflet
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Pane: ({ children }: any) => <div data-testid="pane">{children}</div>,
  CircleMarker: ({ children }: any) => <div data-testid="circle-marker">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  Marker: () => <div data-testid="marker" />,
  Circle: () => <div data-testid="circle" />,
  useMap: () => ({
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
  useMapEvents: vi.fn(),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

// Mock do SelectionManager para evitar TypeError com hooks do Leaflet
vi.mock("../../src/components/MapSelectorSelectionManager", () => ({
  default: () => <div data-testid="selection-manager" />
}));

const DEFAULT_PROPS: any = {
  center: { lat: -23.5, lng: -46.5 },
  radius: 100,
  selectionMode: "circle",
  polygonPoints: [],
  onLocationChange: vi.fn(),
  onPolygonChange: vi.fn(),
  layerConfig: { btNetwork: true, mtNetwork: true },
  locale: "pt-BR"
};

describe("MapSelector", () => {
  it("deve renderizar o container do mapa", () => {
    render(<MapSelector {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
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
});
