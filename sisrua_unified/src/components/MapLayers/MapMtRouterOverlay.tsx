/**
 * MapMtRouterOverlay – Camada de mapa para o MT Router.
 *
 * Renderiza:
 *   – Marcador de origem MT (triângulo azul)
 *   – Marcadores de terminais candidatos (círculo ciano)
 *   – Segmentos de rota calculados (polylines azul neon tracejadas → sólidas no resultado final)
 *
 * Referência: STRATEGIC_ROADMAP_2026 – MT Router Phase 2
 */

import React from "react";
import { Pane, Polyline, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import type { MtRouterState, MtLatLon } from "../../hooks/useMtRouter";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MapMtRouterOverlayProps {
  state: MtRouterState;
  onMapClick: (pos: MtLatLon) => void;
}

// ─── Constantes visuais ────────────────────────────────────────────────────────

const MT_SOURCE_COLOR = "#2563eb"; // blue-600
const MT_SOURCE_FILL = "#bfdbfe";  // blue-200
const MT_TERMINAL_COLOR = "#06b6d4"; // cyan-500
const MT_TERMINAL_FILL = "#cffafe"; // cyan-100
const MT_ROUTE_COLOR = "#00d4ff";   // neon cyan
const MT_ROUTE_WEIGHT_DRAFT = 2;
const MT_ROUTE_WEIGHT_RESULT = 3.5;
const MT_ROUTE_DASH_DRAFT = "6 4";
const MT_PANE_Z = 460;

// ─── Subcomponente: listener de cliques ───────────────────────────────────────

function MapClickListener({ onMapClick }: { onMapClick: (pos: MtLatLon) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

// ─── Componente principal ──────────────────────────────────────────────────────

const MapMtRouterOverlay: React.FC<MapMtRouterOverlayProps> = ({ state, onMapClick }) => {
  const isSelecting =
    state.selectionMode === "picking_source" || state.selectionMode === "picking_terminals";

  const hasResult = state.result !== null && state.result.feasible;

  return (
    <>
      {/* Listener de cliques só ativo quando em modo de seleção */}
      {isSelecting && <MapClickListener onMapClick={onMapClick} />}

      <Pane name="mt-router-overlay" style={{ zIndex: MT_PANE_Z }}>
        {/* ── Rotas calculadas (resultado final) ── */}
        {hasResult &&
          state.result!.edges.map((edge, i) => {
            const from = edge.latLon[0];
            const to = edge.latLon[1];
            return (
              <Polyline
                key={`mt-edge-${i}`}
                positions={[
                  [from.lat, from.lon],
                  [to.lat, to.lon],
                ]}
                pathOptions={{
                  color: MT_ROUTE_COLOR,
                  weight: MT_ROUTE_WEIGHT_RESULT,
                  opacity: 0.9,
                  className: "mt-router-result-path",
                }}
              >
                <Tooltip sticky>
                  <span className="text-xs">{edge.distanceMeters.toFixed(0)} m</span>
                </Tooltip>
              </Polyline>
            );
          })}

        {/* ── Linhas provisórias: origem → terminais sem rota calculada ── */}
        {!hasResult &&
          state.source &&
          state.terminals.map((t) => (
            <Polyline
              key={`mt-draft-${t.id}`}
              positions={[
                [state.source!.lat, state.source!.lon],
                [t.position.lat, t.position.lon],
              ]}
              pathOptions={{
                color: MT_ROUTE_COLOR,
                weight: MT_ROUTE_WEIGHT_DRAFT,
                opacity: 0.45,
                dashArray: MT_ROUTE_DASH_DRAFT,
                className: "mt-router-draft-path",
              }}
            />
          ))}

        {/* ── Terminais ── */}
        {state.terminals.map((t) => {
          const isUnreachable =
            state.result?.unreachableTerminals.includes(t.id) ?? false;
          return (
            <CircleMarker
              key={`mt-terminal-${t.id}`}
              center={[t.position.lat, t.position.lon]}
              radius={6}
              pathOptions={{
                color: isUnreachable ? "#ef4444" : MT_TERMINAL_COLOR,
                fillColor: isUnreachable ? "#fecaca" : MT_TERMINAL_FILL,
                fillOpacity: 0.85,
                weight: 2,
                className: "mt-router-terminal",
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="text-xs font-bold">
                  {t.name ?? t.id}
                  {isUnreachable ? " ⚠ não alcançado" : ""}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── Origem MT ── */}
        {state.source && (
          <CircleMarker
            center={[state.source.lat, state.source.lon]}
            radius={9}
            pathOptions={{
              color: MT_SOURCE_COLOR,
              fillColor: MT_SOURCE_FILL,
              fillOpacity: 0.9,
              weight: 2.5,
              className: "mt-router-source",
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -12]}>
              <span className="text-xs font-bold text-blue-800">Origem MT</span>
            </Tooltip>
          </CircleMarker>
        )}
      </Pane>
    </>
  );
};

export default MapMtRouterOverlay;
