/**
 * MapSelectorDgOverlay.test.tsx — Vitest: camada de sobreposição DG no mapa.
 * Testa renderização de arestas e trafo a partir do cenário DG.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ─── Mock react-leaflet ────────────────────────────────────────────────────────

vi.mock("react-leaflet", () => ({
  Pane: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "leaflet-pane" }, children),
  Polyline: ({
    children,
    positions,
  }: {
    children?: React.ReactNode;
    positions: unknown;
  }) =>
    React.createElement(
      "div",
      {
        "data-testid": "leaflet-polyline",
        "data-positions": JSON.stringify(positions),
      },
      children,
    ),
  CircleMarker: ({
    children,
    center,
  }: {
    children?: React.ReactNode;
    center: unknown;
  }) =>
    React.createElement(
      "div",
      {
        "data-testid": "leaflet-circlemarker",
        "data-center": JSON.stringify(center),
      },
      children,
    ),
  Tooltip: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "leaflet-tooltip" }, children),
}));

import MapSelectorDgOverlay from "../../src/components/MapLayers/MapSelectorDgOverlay";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SCENARIO = {
  scenarioId: "sc-1",
  trafoPositionLatLon: { lat: -22.906, lon: -43.106 },
  edges: [
    { fromPoleId: "p1", toPoleId: "p2", lengthMeters: 25 },
    { fromPoleId: "p2", toPoleId: "p3", lengthMeters: 15 },
  ],
  electricalResult: {
    cqtMaxFraction: 0.04,
    worstTerminalNodeId: "p3",
    trafoUtilizationFraction: 0.35,
    totalCableLengthMeters: 40,
    feasible: true,
  },
  objectiveScore: 88.0,
  scoreComponents: {
    cableCostScore: 85,
    poleCostScore: 90,
    trafoCostScore: 88,
    cqtPenaltyScore: 92,
    overloadPenaltyScore: 95,
  },
  violations: [],
  feasible: true,
};

const POLES_MAP = new Map([
  ["p1", { lat: -22.905, lng: -43.105 }],
  ["p2", { lat: -22.906, lng: -43.106 }],
  ["p3", { lat: -22.907, lng: -43.107 }],
]);

// ─── Testes ────────────────────────────────────────────────────────────────────

describe("MapSelectorDgOverlay", () => {
  it("renderiza o pane de overlay DG", () => {
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: POLES_MAP,
      }),
    );
    expect(screen.getByTestId("leaflet-pane")).toBeInTheDocument();
  });

  it("renderiza polylines para arestas com postes conhecidos", () => {
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: POLES_MAP,
      }),
    );
    const polylines = screen.getAllByTestId("leaflet-polyline");
    expect(polylines).toHaveLength(2);
  });

  it("não renderiza aresta quando poste de origem não está no mapa", () => {
    const polesPartial = new Map([["p1", { lat: -22.905, lng: -43.105 }]]);
    // Aresta p1→p2 deve ser omitida (p2 desconhecido)
    // Aresta p2→p3 também omitida (ambos desconhecidos)
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: polesPartial,
      }),
    );
    expect(screen.queryAllByTestId("leaflet-polyline")).toHaveLength(0);
  });

  it("renderiza CircleMarker para a posição do trafo", () => {
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: POLES_MAP,
      }),
    );
    const marker = screen.getByTestId("leaflet-circlemarker");
    expect(marker).toBeInTheDocument();
    const center = JSON.parse(marker.getAttribute("data-center") ?? "null");
    expect(center).toEqual([-22.906, -43.106]);
  });

  it("exibe tooltip com score do trafo DG", () => {
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: POLES_MAP,
      }),
    );
    expect(screen.getByText(/88/)).toBeInTheDocument();
  });

  it("exibe comprimento das arestas nos tooltips", () => {
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: MOCK_SCENARIO,
        polesById: POLES_MAP,
      }),
    );
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it("não renderiza polylines quando não há arestas no cenário", () => {
    const scenarioNoEdges = { ...MOCK_SCENARIO, edges: [] };
    render(
      React.createElement(MapSelectorDgOverlay, {
        paneName: "dg-test-pane",
        scenario: scenarioNoEdges,
        polesById: POLES_MAP,
      }),
    );
    expect(screen.queryAllByTestId("leaflet-polyline")).toHaveLength(0);
    // Trafo ainda deve aparecer
    expect(screen.getByTestId("leaflet-circlemarker")).toBeInTheDocument();
  });
});
