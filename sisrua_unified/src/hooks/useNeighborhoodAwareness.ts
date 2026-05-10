import { useState, useEffect, useMemo } from "react";
import L from "leaflet";
import { ProjectService } from "../services/projectService";
import { SelectionMode } from "../types";

export function useNeighborhoodAwareness(
  center: { lat: number, lng: number },
  selectionMode: SelectionMode,
  polygonPoints: [number, number][],
  excludeProjectId?: string
) {
  const [neighbors, setNeighbors] = useState<Array<{ id: string; name: string; polygon: Array<[number, number]> }>>([]);

  useEffect(() => {
    const fetchNeighbors = async () => {
       const data = await ProjectService.listNeighboringProjects({
         south: center.lat - 0.05,
         north: center.lat + 0.05,
         west: center.lng - 0.05,
         east: center.lng + 0.05
       }, excludeProjectId);
       setNeighbors(data);
    };
    fetchNeighbors();
  }, [center, excludeProjectId]);

  const hasCollision = useMemo(() => {
    if (selectionMode !== "polygon" || polygonPoints.length < 3 || neighbors.length === 0) return false;
    
    try {
      const currentPoly = L.polygon(polygonPoints);
      const currentBounds = currentPoly.getBounds();

      return neighbors.some(n => {
         const neighborPoly = L.polygon(n.polygon);
         return currentBounds.intersects(neighborPoly.getBounds());
      });
    } catch {
      return false;
    }
  }, [selectionMode, polygonPoints, neighbors]);

  return { neighbors, hasCollision };
}
