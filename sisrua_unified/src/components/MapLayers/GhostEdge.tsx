import React from "react";
import { Polyline, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import { MapBtPole } from "../../types.map";

interface GhostEdgeProps {
  startPole: MapBtPole;
  mousePos: L.LatLng;
}

/**
 * Renderiza um "Vão Fantasma" (Ghost Edge) ao iniciar uma nova conexão no mapa.
 * Fornece feedback visual de distância e validade técnica (Cores: Azul, Laranja, Vermelho).
 */
export function GhostEdge({ startPole, mousePos }: GhostEdgeProps) {
  const distance = L.latLng(startPole.lat, startPole.lng).distanceTo(mousePos);
  const color =
    distance > 40 ? "#ef4444" : distance > 30 ? "#f59e0b" : "#3b82f6";

  return (
    <>
      <Polyline
        positions={[
          [startPole.lat, startPole.lng],
          [mousePos.lat, mousePos.lng],
        ]}
        pathOptions={{ color, weight: 2, dashArray: "5 10", opacity: 0.6 }}
      />
      <Marker
        position={[
          (startPole.lat + mousePos.lat) / 2,
          (startPole.lng + mousePos.lng) / 2,
        ]}
        icon={L.divIcon({
          className: "ghost-edge-label",
          html: `<div class="px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 shadow-md text-[10px] font-black whitespace-nowrap" style="color: ${color}; transform: translateY(-10px);">${distance.toFixed(1)}m</div>`,
          iconSize: [0, 0],
        })}
        interactive={false}
      />
      <Circle
        center={[startPole.lat, startPole.lng]}
        radius={30}
        pathOptions={{
          color: "#3b82f6",
          weight: 1,
          fillOpacity: 0.02,
          interactive: false,
        }}
      />
      <Circle
        center={[startPole.lat, startPole.lng]}
        radius={40}
        pathOptions={{
          color: "#f59e0b",
          weight: 1,
          fillOpacity: 0.01,
          dashArray: "5 5",
          interactive: false,
        }}
      />
    </>
  );
}
