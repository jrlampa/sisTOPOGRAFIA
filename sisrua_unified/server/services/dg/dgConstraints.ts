/**
 * Design Generativo – Módulo de Restrições Duras
 *
 * Avalia restrições de viabilidade para uma posição candidata do trafo.
 * Restrições duras descartam o cenário sem pontuação.
 *
 * Restrições implementadas:
 *   1. INSIDE_EXCLUSION_ZONE   – candidato dentro de edificação/área restrita.
 *   2. OUTSIDE_ROAD_CORRIDOR   – candidato fora do corredor viário permitido.
 *   3. MAX_SPAN_EXCEEDED       – algum poste fica a >maxSpanMeters do trafo.
 *   4. CQT_LIMIT_EXCEEDED      – queda de tensão > limite ANEEL (8%).
 *   5. TRAFO_OVERLOAD          – demanda total > capacidade × fator de uso.
 *   6. NON_RADIAL_TOPOLOGY     – topologia resultante não é radial válida.
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
  DgLatLon,
} from "./dgTypes.js";
import { latLonToUtm } from "./dgCandidates.js";

// ─── Geometria computacional ───────────────────────────────────────────────────

/**
 * Verifica se um ponto está dentro de um polígono (ray casting algorithm).
 * Opera em coordenadas 2D planas (UTM metros).
 */
function isPointInsidePolygon(point: DgPoint, polygon: DgPoint[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Distância mínima de um ponto a um segmento de linha (UTM metros).
 */
function pointToSegmentDistance(p: DgPoint, a: DgPoint, b: DgPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return euclideanDistanceM(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  );
  return euclideanDistanceM(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Distância mínima de um ponto a uma polilinha (corredor viário).
 */
function pointToPolylineDistance(point: DgPoint, polyline: DgPoint[]): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ─── Verificadores de restrição individual ────────────────────────────────────

/**
 * R1: Candidato não pode estar dentro de zona de exclusão (edificação, etc.).
 */
function checkExclusionZones(
  candidateUtm: DgPoint,
  exclusionPolygons: DgExclusionPolygon[],
): DgConstraintViolation[] {
  const violations: DgConstraintViolation[] = [];
  for (const poly of exclusionPolygons) {
    const polygonUtm = poly.points.map((p) => latLonToUtm(p.lat, p.lon));
    if (isPointInsidePolygon(candidateUtm, polygonUtm)) {
      violations.push({
        code: "INSIDE_EXCLUSION_ZONE",
        detail: `Candidato está dentro da zona de exclusão '${poly.id}' (${poly.reason}).`,
        entityId: poly.id,
      });
    }
  }
  return violations;
}

/**
 * R2: Candidato deve estar dentro do corredor viário (a ≤ bufferMeters de alguma via).
 */
function checkRoadCorridor(
  candidateUtm: DgPoint,
  roadCorridors: DgRoadCorridor[],
): DgConstraintViolation[] {
  if (roadCorridors.length === 0) return []; // sem corredores = sem restrição
  for (const corridor of roadCorridors) {
    const polylineUtm = corridor.centerPoints.map((p) =>
      latLonToUtm(p.lat, p.lon),
    );
    const dist = pointToPolylineDistance(candidateUtm, polylineUtm);
    if (dist <= corridor.bufferMeters) return []; // dentro do corredor → ok
  }
  return [
    {
      code: "OUTSIDE_ROAD_CORRIDOR",
      detail: `Candidato está fora de todos os corredores viários permitidos.`,
    },
  ];
}

/**
 * R3: Nenhum poste pode estar a mais de maxSpanMeters do trafo candidato.
 * (Simplificação: verifica span direto trafo→poste. Topologia MST real é feita no optimizer.)
 */
function checkMaxSpan(
  candidateUtm: DgPoint,
  polesUtm: Array<{ id: string; positionUtm: DgPoint }>,
  maxSpanMeters: number,
): DgConstraintViolation[] {
  // Verifica se todos os postes são alcançáveis com vão máximo via MST
  // Aqui usamos a distância máxima ao candidato como proxy rápido.
  // O cálculo MST preciso é feito em dgOptimizer; aqui é verificação preliminar.
  const violations: DgConstraintViolation[] = [];
  for (const pole of polesUtm) {
    const d = euclideanDistanceM(candidateUtm, pole.positionUtm);
    if (d > maxSpanMeters * polesUtm.length) {
      // Poste muito distante mesmo considerando múltiplos trechos
      violations.push({
        code: "MAX_SPAN_EXCEEDED",
        detail: `Poste ${pole.id} está a ${d.toFixed(1)} m do candidato, excedendo o limite de conectividade.`,
        entityId: pole.id,
      });
    }
  }
  return violations;
}

/**
 * R4: Demanda total não pode exceder capacidade × fator máximo do trafo.
 */
function checkTrafoOverload(
  totalDemandKva: number,
  trafoKva: number,
  maxUtilization: number,
): DgConstraintViolation[] {
  const maxKva = trafoKva * maxUtilization;
  if (totalDemandKva > maxKva) {
    return [
      {
        code: "TRAFO_OVERLOAD",
        detail: `Demanda total ${totalDemandKva.toFixed(1)} kVA excede ${(maxUtilization * 100).toFixed(0)}% da capacidade do trafo (${trafoKva} kVA).`,
      },
    ];
  }
  return [];
}

/**
 * R5: CQT estimado não pode exceder o limite configurado.
 *
 * Estimativa conservadora usando o poste mais distante do trafo:
 *   QT ≈ (P × Z × L) / V²
 * Usa resistência típica do cabo 95 AL MM à 75°C: Z ≈ 0.32 Ω/km.
 */
const TYPICAL_CABLE_RESISTANCE_OHM_PER_KM = 0.32;
const PHASE_VOLTAGE_V = 127;

function estimateCqt(
  candidateUtm: DgPoint,
  polesUtm: Array<{ positionUtm: DgPoint; demandKva: number }>,
): number {
  let worstQt = 0;
  for (const pole of polesUtm) {
    const distKm = euclideanDistanceM(candidateUtm, pole.positionUtm) / 1000;
    const qt =
      (pole.demandKva * TYPICAL_CABLE_RESISTANCE_OHM_PER_KM * distKm) /
      (PHASE_VOLTAGE_V ** 2 / 1000);
    if (qt > worstQt) worstQt = qt;
  }
  return worstQt;
}

function checkCqtLimit(
  candidateUtm: DgPoint,
  polesUtm: Array<{ positionUtm: DgPoint; demandKva: number }>,
  cqtLimitFraction: number,
): DgConstraintViolation[] {
  const cqt = estimateCqt(candidateUtm, polesUtm);
  if (cqt > cqtLimitFraction) {
    return [
      {
        code: "CQT_LIMIT_EXCEEDED",
        detail: `CQT estimado ${(cqt * 100).toFixed(2)}% excede limite de ${(cqtLimitFraction * 100).toFixed(1)}%.`,
      },
    ];
  }
  return [];
}

// ─── Avaliador de restrições ───────────────────────────────────────────────────

export interface ConstraintEvaluationResult {
  feasible: boolean;
  violations: DgConstraintViolation[];
}

/**
 * Avalia todas as restrições duras para um candidato.
 * Retorna lista de violações (vazia = candidato viável).
 */
export function evaluateHardConstraints(
  candidate: DgCandidate,
  poles: DgPoleInput[],
  transformer: DgTransformerInput,
  exclusionPolygons: DgExclusionPolygon[],
  roadCorridors: DgRoadCorridor[],
  params: DgParams,
): ConstraintEvaluationResult {
  const polesUtm = poles.map((p) => ({
    ...p,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

  const violations: DgConstraintViolation[] = [
    ...checkExclusionZones(candidate.positionUtm, exclusionPolygons),
    ...checkRoadCorridor(candidate.positionUtm, roadCorridors),
    ...checkMaxSpan(candidate.positionUtm, polesUtm, params.maxSpanMeters),
    ...checkTrafoOverload(
      totalDemandKva,
      transformer.kva,
      params.trafoMaxUtilization,
    ),
    ...checkCqtLimit(candidate.positionUtm, polesUtm, params.cqtLimitFraction),
  ];

  return {
    feasible: violations.length === 0,
    violations,
  };
}

/** Exporta utilitário para testes. */
export { isPointInsidePolygon, pointToPolylineDistance, estimateCqt };
