/**
 * Design Generativo – Módulo de Restrições Duras
 *
 * Avalia restrições de viabilidade para uma posição candidata do trafo.
 * Restrições duras descartam o cenário sem pontuação.
 *
 * Todas as verificações geométricas operam em coordenadas UTM (metros).
 */

import { euclideanDistanceM } from "./dgCandidates.js";
import type {
  DgCandidate,
  DgPoleInput,
  DgTransformerInput,
  DgExclusionPolygon,
  DgRoadCorridor,
  DgParams,
  DgConstraintViolation,
  DgPoint,
  OsmHighwayClass,
} from "./dgTypes.js";
import { latLonToUtm } from "./dgCandidates.js";

// ─── Geometria computacional ───────────────────────────────────────────────────

function isPointInsidePolygon(point: DgPoint, polygon: DgPoint[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointToSegmentDistance(p: DgPoint, a: DgPoint, b: DgPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return euclideanDistanceM(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return euclideanDistanceM(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function pointToPolylineDistance(point: DgPoint, polyline: DgPoint[]): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Verifica se o segmento AB intersecta o segmento CD. */
function segmentsIntersect(a: DgPoint, b: DgPoint, c: DgPoint, d: DgPoint): boolean {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (det === 0) return false;
  const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
  const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

/** Verifica se um trecho (edge) cruza qualquer aresta de um polígono de exclusão. */
export function isEdgeCrossingExclusionZone(a: DgPoint, b: DgPoint, exclusionPolygons: DgExclusionPolygon[]): boolean {
  for (const poly of exclusionPolygons) {
    const polyUtm = poly.points.map(p => latLonToUtm(p.lat, p.lon));
    // Verifica se cruza qualquer aresta do polígono
    for (let i = 0, j = polyUtm.length - 1; i < polyUtm.length; j = i++) {
      if (segmentsIntersect(a, b, polyUtm[i], polyUtm[j])) return true;
    }
    // Opcional: Verifica se ambos os pontos estão dentro (totalmente imerso)
    if (isPointInsidePolygon(a, polyUtm) && isPointInsidePolygon(b, polyUtm)) return true;
  }
  return false;
}

// ─── Verificadores de restrição individual ────────────────────────────────────

function checkExclusionZones(candidateUtm: DgPoint, exclusionPolygons: DgExclusionPolygon[]): DgConstraintViolation[] {
  const violations: DgConstraintViolation[] = [];
  for (const poly of exclusionPolygons) {
    const polygonUtm = poly.points.map((p) => latLonToUtm(p.lat, p.lon));
    if (isPointInsidePolygon(candidateUtm, polygonUtm)) {
      violations.push({ code: "INSIDE_EXCLUSION_ZONE", detail: `Candidato dentro da zona '${poly.id}'.`, entityId: poly.id });
    }
  }
  return violations;
}

const SIDEWALK_OFFSET_BY_CLASS: Record<OsmHighwayClass, number> = {
  residential: 3, tertiary: 5, secondary: 7, primary: 9, trunk: 12, unknown: 0
};

function checkRoadCorridor(candidateUtm: DgPoint, roadCorridors: DgRoadCorridor[]): DgConstraintViolation[] {
  if (roadCorridors.length === 0) return [];
  for (const corridor of roadCorridors) {
    const polylineUtm = corridor.centerPoints.map((p) => latLonToUtm(p.lat, p.lon));
    const dist = pointToPolylineDistance(candidateUtm, polylineUtm);
    if (dist > corridor.bufferMeters) continue;

    if (corridor.highwayClass) {
      const minOffset = SIDEWALK_OFFSET_BY_CLASS[corridor.highwayClass];
      if (minOffset > 0 && dist < minOffset) {
        return [{ code: "INSIDE_ROAD_CARRIAGEWAY", detail: `Candidato na pista (${dist.toFixed(1)}m < ${minOffset}m).`, entityId: corridor.id }];
      }
    }
    return [];
  }
  return [{ code: "OUTSIDE_ROAD_CORRIDOR", detail: `Candidato fora dos corredores permitidos.` }];
}

/**
 * R3: Nenhum poste pode estar a mais de um limite razoável para conectividade.
 * Correção: o check preliminar agora usa 2x o maxSpan como margem de segurança
 * para evitar descartar candidatos que poderiam ser viáveis via MST.
 */
function checkMaxSpan(candidateUtm: DgPoint, polesUtm: Array<{ id: string; positionUtm: DgPoint }>, maxSpanMeters: number): DgConstraintViolation[] {
  const violations: DgConstraintViolation[] = [];
  // Se o poste mais próximo está a mais que o limite acumulado plausível (ex: 3 vãos)
  // descartamos logo. O MST final fará o check rigoroso.
  for (const pole of polesUtm) {
    const d = euclideanDistanceM(candidateUtm, pole.positionUtm);
    if (d > maxSpanMeters * 3) { // Reduzido de poles.length (frouxo) para 3 (médio/razoável)
      violations.push({ code: "MAX_SPAN_EXCEEDED", detail: `Poste ${pole.id} muito distante (${d.toFixed(1)}m).`, entityId: pole.id });
    }
  }
  return violations;
}

function checkTrafoOverload(totalDemandKva: number, trafoKva: number, maxUtilization: number): DgConstraintViolation[] {
  const maxKva = trafoKva * maxUtilization;
  if (totalDemandKva > maxKva) {
    return [{ code: "TRAFO_OVERLOAD", detail: `Demanda ${totalDemandKva.toFixed(1)}kVA > ${maxKva.toFixed(1)}kVA.` }];
  }
  return [];
}

/**
 * R5: CQT estimado.
 * Correção: Fórmula unificada com núcleo BT (divisor 1000 * V²).
 */
const TYPICAL_CABLE_RESISTANCE_OHM_PER_KM = 0.32;
const PHASE_VOLTAGE_V = 127;

function estimateCqt(candidateUtm: DgPoint, polesUtm: Array<{ positionUtm: DgPoint; demandKva: number }>): number {
  let worstQt = 0;
  for (const pole of polesUtm) {
    const distM = euclideanDistanceM(candidateUtm, pole.positionUtm);
    // Formula: (P * Z * L_m) / (1000 * V²)
    const qt = (pole.demandKva * TYPICAL_CABLE_RESISTANCE_OHM_PER_KM * distM) / (1000 * PHASE_VOLTAGE_V ** 2);
    if (qt > worstQt) worstQt = qt;
  }
  return worstQt;
}

function checkCqtLimit(candidateUtm: DgPoint, polesUtm: Array<{ positionUtm: DgPoint; demandKva: number }>, cqtLimitFraction: number): DgConstraintViolation[] {
  const cqt = estimateCqt(candidateUtm, polesUtm);
  if (cqt > cqtLimitFraction) {
    return [{ code: "CQT_LIMIT_EXCEEDED", detail: `CQT estimado ${(cqt * 100).toFixed(2)}% > ${(cqtLimitFraction * 100).toFixed(1)}%.` }];
  }
  return [];
}

export interface ConstraintEvaluationResult { feasible: boolean; violations: DgConstraintViolation[]; }

export function evaluateHardConstraints(candidate: DgCandidate, poles: DgPoleInput[], transformer: DgTransformerInput | undefined, exclusionPolygons: DgExclusionPolygon[], roadCorridors: DgRoadCorridor[], params: DgParams): ConstraintEvaluationResult {
  const polesUtm = poles.map((p) => ({ ...p, positionUtm: latLonToUtm(p.position.lat, p.position.lon) }));
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const violations: DgConstraintViolation[] = [
    ...checkExclusionZones(candidate.positionUtm, exclusionPolygons),
    ...checkRoadCorridor(candidate.positionUtm, roadCorridors),
    ...checkMaxSpan(candidate.positionUtm, polesUtm, params.maxSpanMeters),
    ...(transformer ? checkTrafoOverload(totalDemandKva, transformer.kva, params.trafoMaxUtilization) : []),
    ...checkCqtLimit(candidate.positionUtm, polesUtm, params.cqtLimitFraction),
  ];
  return { feasible: violations.length === 0, violations };
}

export { isPointInsidePolygon, pointToPolylineDistance, estimateCqt, checkTrafoOverload };
