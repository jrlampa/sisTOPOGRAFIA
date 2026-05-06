/**
 * Design Generativo — MST (Kruskal)
 */

import {
  euclideanDistanceM,
  latLonToUtm,
} from "./dgCandidates.js";
import {
  isEdgeCrossingExclusionZone,
  pointToPolylineDistance,
} from "./dgConstraints.js";
import type {
  DgExclusionPolygon,
  DgRoadCorridor,
} from "./dgTypes.js";

export interface MstEdge {
  fromId: string;
  toId: string;
  lengthMeters: number;
}

class UnionFind {
  private parent: Map<string, string>;
  constructor(ids: string[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(x: string): string {
    if (this.parent.get(x) !== x)
      this.parent.set(x, this.find(this.parent.get(x)!));
    return this.parent.get(x)!;
  }
  union(a: string, b: string): boolean {
    const ra = this.find(a),
      rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

export function buildMst(
  trafoId: string,
  poles: Array<{ id: string; positionUtm: { x: number; y: number } }>,
  trafoUtm: { x: number; y: number },
  exclusionPolygons: DgExclusionPolygon[] = [],
  roadCorridors: DgRoadCorridor[] = [],
): MstEdge[] {
  const allNodes = [{ id: trafoId, positionUtm: trafoUtm }, ...poles];
  const allEdges: MstEdge[] = [];
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const posA = allNodes[i].positionUtm;
      const posB = allNodes[j].positionUtm;

      // Se o trecho cruza uma zona de exclusão, ignoramos
      if (isEdgeCrossingExclusionZone(posA, posB, exclusionPolygons)) continue;

      // Se temos corredores de rua, o ponto médio do trecho deve estar dentro de um deles
      if (roadCorridors.length > 0) {
        const mid = { x: (posA.x + posB.x) / 2, y: (posA.y + posB.y) / 2 };
        const insideRoad = roadCorridors.some((corridor) => {
          const polylineUtm = corridor.centerPoints.map((p) =>
            latLonToUtm(p.lat, p.lon),
          );
          return (
            pointToPolylineDistance(mid, polylineUtm) <= corridor.bufferMeters
          );
        });
        if (!insideRoad) continue;
      }

      allEdges.push({
        fromId: allNodes[i].id,
        toId: allNodes[j].id,
        lengthMeters: Math.max(0.001, euclideanDistanceM(posA, posB)),
      });
    }
  }
  allEdges.sort((a, b) => a.lengthMeters - b.lengthMeters);
  const uf = new UnionFind(allNodes.map((n) => n.id));
  const mst: MstEdge[] = [];
  for (const edge of allEdges) {
    if (uf.union(edge.fromId, edge.toId)) {
      mst.push(edge);
      if (mst.length === allNodes.length - 1) break;
    }
  }
  return mst;
}

export function mstHasSpanViolation(
  mst: MstEdge[],
  maxSpanMeters: number,
): string | null {
  for (const edge of mst) {
    if (edge.lengthMeters > maxSpanMeters)
      return `Trecho ${edge.fromId}→${edge.toId} tem ${edge.lengthMeters.toFixed(1)} m > ${maxSpanMeters} m`;
  }
  return null;
}
