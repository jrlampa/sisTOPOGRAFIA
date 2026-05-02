/**
 * smartSnapping.ts
 *
 * Utilitário de snapping ortogonal/alinhamento para postes BT.
 * Ao arrastar um poste, verifica se ele está próximo o suficiente
 * de uma linha cardinal (N/S ou L/O) relativa a seus vizinhos diretos.
 * Se sim, "atrai" o poste para essa linha (snap magnético).
 *
 * Princípio 2.5D: opera apenas em lat/lng (sem z).
 */

export interface SnapTarget {
  lat: number;
  lng: number;
}

export interface SnapNeighbor {
  lat: number;
  lng: number;
}

const SNAP_THRESHOLD_DEG = 0.00008; // ~8m em latitudes equatoriais

/**
 * Dado um poste arrastado e seus vizinhos diretos (arestas),
 * retorna as coordenadas com snapping ortogonal aplicado se
 * o poste estiver dentro do limiar de atração.
 */
export function applyOrthoSnap(
  lat: number,
  lng: number,
  neighbors: SnapNeighbor[],
): SnapTarget {
  let snappedLat = lat;
  let snappedLng = lng;

  for (const neighbor of neighbors) {
    const dlat = Math.abs(lat - neighbor.lat);
    const dlng = Math.abs(lng - neighbor.lng);

    // Snap horizontal (mesmo lat que o vizinho) – alinhamento L/O
    if (dlat < SNAP_THRESHOLD_DEG && dlat < dlng) {
      snappedLat = neighbor.lat;
      break; // prioriza primeiro snap encontrado
    }

    // Snap vertical (mesmo lng que o vizinho) – alinhamento N/S
    if (dlng < SNAP_THRESHOLD_DEG && dlng < dlat) {
      snappedLng = neighbor.lng;
      break;
    }
  }

  return { lat: snappedLat, lng: snappedLng };
}
