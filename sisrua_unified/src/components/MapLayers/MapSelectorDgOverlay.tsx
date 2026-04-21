/**
 * MapSelectorDgOverlay – Camada de mapa para visualização do cenário DG.
 *
 * Renderiza as arestas sugeridas pelo motor de Design Generativo como
 * polylines violet tracejadas e a nova posição do trafo como marcador.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 3 (Sprint 3)
 */

import React from "react";
import { Pane, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import type { DgScenario } from "../../hooks/useDgOptimization";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MapSelectorDgOverlayProps {
  paneName: string;
  scenario: DgScenario;
  /** Mapa id → {lat, lng} dos postes existentes para resolver coordenadas. */
  polesById: Map<string, { lat: number; lng: number }>;
}

// ─── Constantes visuais ────────────────────────────────────────────────────────

const DG_EDGE_COLOR = "#7c3aed"; // violet-700
const DG_EDGE_WEIGHT = 3;
const DG_EDGE_OPACITY = 0.85;
const DG_EDGE_DASH = "8 4";
const DG_TRAFO_COLOR = "#6d28d9"; // violet-800
const DG_TRAFO_FILL = "#c4b5fd"; // violet-300
const DG_TRAFO_RADIUS = 9;

// ─── Componente ────────────────────────────────────────────────────────────────

const MapSelectorDgOverlay: React.FC<MapSelectorDgOverlayProps> = ({
  paneName,
  scenario,
  polesById,
}) => {
  const trafo = scenario.trafoPositionLatLon;

  // Resolve posições das arestas a partir do mapa de postes
  const resolvedEdges = React.useMemo(() => {
    return scenario.edges.flatMap((edge) => {
      const from = polesById.get(edge.fromPoleId);
      const to = polesById.get(edge.toPoleId);
      if (!from || !to) return [];
      return [
        {
          key: `${edge.fromPoleId}-${edge.toPoleId}`,
          positions: [
            [from.lat, from.lng] as [number, number],
            [to.lat, to.lng] as [number, number],
          ],
          lengthM: edge.lengthMeters,
        },
      ];
    });
  }, [scenario.edges, polesById]);

  return (
    <Pane name={paneName} style={{ zIndex: 450 }}>
      {/* Arestas DG sugeridas */}
      {resolvedEdges.map((edge) => (
        <Polyline
          key={edge.key}
          positions={edge.positions}
          pathOptions={{
            color: DG_EDGE_COLOR,
            weight: DG_EDGE_WEIGHT,
            opacity: DG_EDGE_OPACITY,
            dashArray: DG_EDGE_DASH,
          }}
        >
          <Tooltip sticky>
            <span className="text-[11px]">
              DG: {edge.lengthM.toFixed(0)} m
            </span>
          </Tooltip>
        </Polyline>
      ))}

      {/* Posição sugerida do trafo */}
      <CircleMarker
        center={[trafo.lat, trafo.lon]}
        radius={DG_TRAFO_RADIUS}
        pathOptions={{
          color: DG_TRAFO_COLOR,
          fillColor: DG_TRAFO_FILL,
          fillOpacity: 0.9,
          weight: 2.5,
        }}
      >
        <Tooltip permanent={false} direction="top">
          <span className="text-[11px] font-bold">
            Trafo DG — Score: {scenario.objectiveScore.toFixed(1)}
          </span>
        </Tooltip>
      </CircleMarker>
    </Pane>
  );
};

export default MapSelectorDgOverlay;
