import React from "react";
import { Pane, Polygon, Circle, Tooltip } from "react-leaflet";
import { SelectionMode } from "../../types";

interface MapJurisdictionLayerProps {
  selectionMode: SelectionMode;
  polygonPoints: [number, number][];
  center: { lat: number; lng: number };
  radius: number;
  neighbors: Array<{ id: string; name: string; polygon: Array<[number, number]> }>;
}

export const MapJurisdictionLayer: React.FC<MapJurisdictionLayerProps> = ({
  selectionMode,
  polygonPoints,
  center,
  radius,
  neighbors
}) => {
  return (
    <Pane name="spatial-jurisdiction-pane" style={{ zIndex: 410 }}>
      {/* Vizinhos (Ghost Jurisdictions) */}
      {neighbors.map(n => (
        <Polygon 
          key={n.id}
          positions={n.polygon}
          pathOptions={{
            color: "#94a3b8",
            weight: 1,
            fillColor: "#475569",
            fillOpacity: 0.1,
            dashArray: "5, 5"
          }}
        >
          <Tooltip sticky direction="top">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
               Jurisdição Vizinha: <span className="text-white">{n.name}</span>
            </div>
          </Tooltip>
        </Polygon>
      ))}

      {/* Jurisdição do Projeto Atual */}
      {selectionMode === "polygon" && polygonPoints.length >= 3 && (
        <>
          <Polygon 
            positions={polygonPoints} 
            pathOptions={{ 
              color: "#6366f1", 
              weight: 4, 
              fillOpacity: 0, 
              dashArray: "10, 10",
            }} 
          />
          {/* Inverted Mask (Darkens outside) */}
          <Polygon
            positions={[
              [[-90, -180], [-90, 180], [90, 180], [90, -180]], // Global Box
              polygonPoints // Hole
            ]}
            pathOptions={{
              color: "#000",
              weight: 0,
              fillColor: "#0f172a",
              fillOpacity: 0.4,
              interactive: false
            }}
          />
        </>
      )}
      
      {selectionMode === "circle" && center && radius && (
        <Circle 
          center={center} 
          radius={radius} 
          pathOptions={{ 
            color: "#6366f1", 
            weight: 4, 
            fillOpacity: 0.03, 
            dashArray: "10, 10",
          }} 
        />
      )}
    </Pane>
  );
};
