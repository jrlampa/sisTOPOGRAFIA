/**
 * SpatialJurisdictionService
 * Lógica pura de geoprocessamento para validação de jurisdição.
 * Independente de bibliotecas de UI (Leaflet) para permitir uso no backend/worker.
 */

interface GeoLoc { lat: number; lng: number; }
type PolyPoint = [number, number] | GeoLoc;
type CenterPoint = [number, number] | GeoLoc;

function toLngLat(p: PolyPoint): [number, number] {
  return Array.isArray(p) ? p : [p.lat, p.lng];
}

function centerToTuple(c: CenterPoint): [number, number] {
  return Array.isArray(c) ? c : [c.lat, c.lng];
}

export class SpatialJurisdictionService {
  /**
   * Verifica se um ponto está dentro de um polígono usando o algoritmo de Ray-Casting.
   */
  static isPointInPolygon(lat: number, lng: number, polygon: Array<PolyPoint>): boolean {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = toLngLat(polygon[i]);
      const [xj, yj] = toLngLat(polygon[j]);

      const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  }

  /**
   * Verifica se um ponto está dentro de uma jurisdição (Polígono ou Raio).
   */
  static isPointInJurisdiction(
    lat: number, 
    lng: number, 
    jurisdiction: { polygon?: Array<PolyPoint>, radius?: number, center?: CenterPoint }
  ): boolean {
    const { polygon, radius, center } = jurisdiction;

    // 1. Prioridade para Polígono
    if (polygon && polygon.length >= 3) {
      return this.isPointInPolygon(lat, lng, polygon);
    }

    // 2. Fallback para Raio (Haversine simplified para curtas distâncias)
    if (radius && center) {
       const R = 6371e3; // Metros
       const [cLat, cLng] = centerToTuple(center);
       const φ1 = lat * Math.PI/180;
       const φ2 = cLat * Math.PI/180;
       const Δφ = (cLat-lat) * Math.PI/180;
       const Δλ = (cLng-lng) * Math.PI/180;

       const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                 Math.cos(φ1) * Math.cos(φ2) *
                 Math.sin(Δλ/2) * Math.sin(Δλ/2);
       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
       const distance = R * c;

       return distance <= radius;
    }

    return true;
  }

  /**
   * Filtra uma topologia completa, mantendo apenas os ativos dentro da jurisdição.
   */
  static filterTopology(
    topology: any, 
    jurisdiction: { polygon?: Array<PolyPoint>, radius?: number, center?: CenterPoint }
  ): any {
    const filteredPoles = (topology.poles || []).filter((p: any) => 
      this.isPointInJurisdiction(p.lat, p.lng, jurisdiction)
    );

    const poleIdsInJurisdiction = new Set(filteredPoles.map((p: any) => p.id));

    const filteredEdges = (topology.edges || []).filter((e: any) => 
      poleIdsInJurisdiction.has(e.fromPoleId) && poleIdsInJurisdiction.has(e.toPoleId)
    );

    const filteredTransformers = (topology.transformers || []).filter((t: any) => 
      poleIdsInJurisdiction.has(t.poleId)
    );

    return {
      ...topology,
      poles: filteredPoles,
      edges: filteredEdges,
      transformers: filteredTransformers
    };
  }

  /**
   * Verifica se um vão (Edge) atravessa a fronteira da jurisdição.
   */
  static isEdgeInterJurisdictional(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number,
    jurisdiction: any
  ): boolean {
    const fromIn = this.isPointInJurisdiction(fromLat, fromLng, jurisdiction);
    const toIn = this.isPointInJurisdiction(toLat, toLng, jurisdiction);
    return fromIn !== toIn;
  }
}
