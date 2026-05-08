import React, { useState } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import { MapBtPole } from "../../types.map";
import { GhostEdge } from "./GhostEdge";

interface MapInteractionLayerProps {
  pendingBtEdgeStartPoleId: string | null | undefined;
  polesById: Map<string, MapBtPole>;
}

/**
 * Camada de interação isolada para rastreio de mouse e ghost edges.
 * Evita re-renderizar todo o MapSelector durante o movimento do mouse.
 */
export const MapInteractionLayer = React.memo(({ 
  pendingBtEdgeStartPoleId, 
  polesById 
}: MapInteractionLayerProps) => {
  const [mousePos, setMousePos] = useState<L.LatLng | null>(null);

  useMapEvents({
    mousemove(e) {
      if (pendingBtEdgeStartPoleId) {
        setMousePos(e.latlng);
      } else if (mousePos) {
        setMousePos(null);
      }
    },
  });

  if (!pendingBtEdgeStartPoleId || !mousePos) return null;

  const startPole = polesById.get(pendingBtEdgeStartPoleId);
  if (!startPole) return null;

  return <GhostEdge startPole={startPole} mousePos={mousePos} />;
});

MapInteractionLayer.displayName = "MapInteractionLayer";
