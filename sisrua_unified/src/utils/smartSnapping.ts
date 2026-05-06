import L from "leaflet";
/**
 * smartSnapping.ts
 *
 * Utilitário de snapping ortogonal/alinhamento para postes BT.
 * Ao arrastar um poste, verifica se ele está próximo o suficiente:
 * 1. De uma linha cardinal (N/S ou L/O) relativa a seus vizinhos diretos.
 * 2. Do eixo da rua (via dados OSM).
 *
 * Princípio 2.5D: opera apenas em lat/lng (sem z).
 */

export interface SnapTarget {
  lat: number;
  lng: number;
  type?: "ortho" | "road";
  snapId?: string; // ID do poste vizinho que causou o snap
}

export interface SnapNeighbor {
  id: string;
  lat: number;
  lng: number;
}

const ORTHO_THRESHOLD_DEG = 0.00008; // ~8m em latitudes equatoriais
const ROAD_THRESHOLD_METERS = 6.0;   // ~6m de atração para o eixo da rua

/**
 * Dado um poste arrastado e seus vizinhos diretos (arestas),
 * retorna as coordenadas com snapping ortogonal aplicado.
 */
export function applyOrthoSnap(
  lat: number,
  lng: number,
  neighbors: SnapNeighbor[],
): SnapTarget {
  let snappedLat = lat;
  let snappedLng = lng;
  let type: "ortho" | undefined;
  let snapId: string | undefined;

  for (const neighbor of neighbors) {
    const dlat = Math.abs(lat - neighbor.lat);
    const dlng = Math.abs(lng - neighbor.lng);

    // Snap horizontal (mesmo lat que o vizinho) – alinhamento L/O
    if (dlat < ORTHO_THRESHOLD_DEG && dlat < dlng) {
      snappedLat = neighbor.lat;
      type = "ortho";
      snapId = neighbor.id;
      break;
    }

    // Snap vertical (mesmo lng que o vizinho) – alinhamento N/S
    if (dlng < ORTHO_THRESHOLD_DEG && dlng < dlat) {
      snappedLng = neighbor.lng;
      type = "ortho";
      snapId = neighbor.id;
      break;
    }
  }

  return { lat: snappedLat, lng: snappedLng, type, snapId };
}

/**
 * Tenta "puxar" o poste para o eixo da rua mais próxima dentro do limiar.
 */
export function applyRoadSnap(
  lat: number,
  lng: number,
  osmElements: any[], // OsmElement[]
): SnapTarget {
  if (!osmElements || osmElements.length === 0) return { lat, lng };

  const p = L.latLng(lat, lng);
  let bestPoint: L.LatLng | null = null;
  let minDistance = ROAD_THRESHOLD_METERS;

  // Filtra apenas highways (ruas)
  const roads = osmElements.filter(el => el.type === "way" && el.tags?.highway);

  for (const road of roads) {
    const geometry = road.geometry || [];
    if (geometry.length < 2) continue;

    for (let i = 0; i < geometry.length - 1; i++) {
      const a = L.latLng(geometry[i].lat, geometry[i].lon);
      const b = L.latLng(geometry[i+1].lat, geometry[i+1].lon);
      
      const closest = L.LineUtil.closestPointOnSegment(
        L.CRS.EPSG3857.latLngToPoint(p, 20),
        L.CRS.EPSG3857.latLngToPoint(a, 20),
        L.CRS.EPSG3857.latLngToPoint(b, 20)
      );
      
      const closestLatLng = L.CRS.EPSG3857.pointToLatLng(closest, 20);
      const dist = p.distanceTo(closestLatLng);

      if (dist < minDistance) {
        minDistance = dist;
        bestPoint = closestLatLng;
      }
    }
  }

  if (bestPoint) {
    return { lat: bestPoint.lat, lng: bestPoint.lng, type: "road" };
  }

  return { lat, lng };
}
