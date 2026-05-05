/**
 * Design Generativo – Geração de Candidatos
 *
 * Gera posições candidatas para realocação de transformador via:
 *   1. Centro de carga de Fermat-Weber (iterativo – ponderado pela demanda).
 *   2. Postes existentes (Modo A – sem novos postes).
 *   3. Grade uniforme (Modo B – novos postes permitidos, fallback).
 *
 * Todas as operações geométricas são realizadas em coordenadas métricas
 * (UTM SIRGAS zona 23S) para evitar distorções angulares em lat/lon.
 */

import crypto from "crypto";
import type {
  DgPoleInput,
  DgCandidate,
  DgPoint,
  DgLatLon,
  DgParams,
  DgOptimizationInput,
} from "./dgTypes.js";

// ─── Conversão geodésica (aproximação UTM zona 23S, SIRGAS 2000) ──────────────

const EARTH_RADIUS_M = 6_371_000;
const ZONE_23S_CENTRAL_MERIDIAN_DEG = -45;

export function latLonToUtm(lat: number, lon: number): DgPoint {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const lon0Rad = (ZONE_23S_CENTRAL_MERIDIAN_DEG * Math.PI) / 180;
  const N = EARTH_RADIUS_M / Math.sqrt(1 - 0.00669438 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = 0.006739496 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lon0Rad);
  const M =
    EARTH_RADIUS_M *
    (0.9983243 * latRad -
      0.002514607 * Math.sin(2 * latRad) +
      0.000002639 * Math.sin(4 * latRad));
  const x =
    0.9996 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * 0.006739496) * A ** 5) / 120) +
    500_000;
  const y =
    0.9996 *
      (M +
        N *
          Math.tan(latRad) *
          (A ** 2 / 2 +
            ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
            ((61 - 58 * T + T ** 2 + 600 * C - 330 * 0.006739496) * A ** 6) /
              720)) +
    (lat < 0 ? 10_000_000 : 0);
  return { x, y };
}

export function utmToLatLon(x: number, y: number): DgLatLon {
  const x0 = x - 500_000;
  const y0 = y - (y > 5_000_000 ? 10_000_000 : 0);
  const M = y0 / 0.9996;
  const mu = M / (EARTH_RADIUS_M * 0.9983243);
  const phi1 = mu + (3 / 2) * 0.001679 * Math.sin(2 * mu);
  const N1 = EARTH_RADIUS_M / Math.sqrt(1 - 0.00669438 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = 0.006739496 * Math.cos(phi1) ** 2;
  const R1 =
    (EARTH_RADIUS_M * (1 - 0.00669438)) /
    (1 - 0.00669438 * Math.sin(phi1) ** 2) ** 1.5;
  const D = x0 / (N1 * 0.9996);
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * 0.006739496) * D ** 4) / 24);
  const lon =
    (ZONE_23S_CENTRAL_MERIDIAN_DEG * Math.PI) / 180 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6) / Math.cos(phi1);
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

export function euclideanDistanceM(a: DgPoint, b: DgPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Fermat-Weber ────────────────────────────────────────────────────────────

const WEISZFELD_MAX_ITER = 500;
const WEISZFELD_TOLERANCE_M = 0.01;

export function fermatWeberCenter(
  poles: Array<{ positionUtm: DgPoint; demandKva: number }>,
): DgPoint {
  if (poles.length === 0) throw new Error("DG: nenhum poste fornecido.");
  if (poles.length === 1) return { ...poles[0].positionUtm };
  const totalDemand = poles.reduce((s, p) => s + p.demandKva, 0);
  let x =
    poles.reduce((s, p) => s + p.positionUtm.x * p.demandKva, 0) / totalDemand;
  let y =
    poles.reduce((s, p) => s + p.positionUtm.y * p.demandKva, 0) / totalDemand;
  for (let iter = 0; iter < WEISZFELD_MAX_ITER; iter++) {
    let numX = 0,
      numY = 0,
      den = 0;
    for (const pole of poles) {
      const d = euclideanDistanceM({ x, y }, pole.positionUtm);
      if (d < 1e-6) continue;
      const wi = pole.demandKva / d;
      numX += wi * pole.positionUtm.x;
      numY += wi * pole.positionUtm.y;
      den += wi;
    }
    if (den < 1e-10) break;
    const newX = numX / den,
      newY = numY / den;
    const delta = euclideanDistanceM({ x, y }, { x: newX, y: newY });
    x = newX;
    y = newY;
    if (delta < WEISZFELD_TOLERANCE_M) break;
  }
  return { x, y };
}

// ─── Geração de Candidatos ───────────────────────────────────────────────────

export function generateCandidates(
  poles: DgPoleInput[],
  params: DgParams,
): DgCandidate[] {
  const candidates: DgCandidate[] = [];
  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    demandKva: p.demandKva,
  }));

  // 1. Postes existentes
  for (const p of poles) {
    candidates.push({
      candidateId: `pole-${p.id}`,
      position: p.position,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
      weightedDistanceSum: 0,
      source: "existing_pole",
    });
  }

  // 2. Fermat-Weber
  try {
    const fw = fermatWeberCenter(polesUtm);
    candidates.push({
      candidateId: "fermat-weber",
      position: utmToLatLon(fw.x, fw.y),
      positionUtm: fw,
      weightedDistanceSum: 0,
      source: "fermat_weber",
    });
  } catch (_e) {
    /* ignore */
  }

  // 3. Grid (se permitido)
  if (params.allowNewPoles) {
    const minX = Math.min(...polesUtm.map((p) => p.positionUtm.x)) - 50;
    const maxX = Math.max(...polesUtm.map((p) => p.positionUtm.x)) + 50;
    const minY = Math.min(...polesUtm.map((p) => p.positionUtm.y)) - 50;
    const maxY = Math.max(...polesUtm.map((p) => p.positionUtm.y)) + 50;
    const step = params.gridSpacingMeters || 20;
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        candidates.push({
          candidateId: `grid-${Math.round(x)}-${Math.round(y)}`,
          position: utmToLatLon(x, y),
          positionUtm: { x, y },
          weightedDistanceSum: 0,
          source: "grid",
        });
      }
    }
  }

  if (
    params.searchMode === "heuristic" &&
    candidates.length > params.maxCandidatesHeuristic
  ) {
    return candidates.slice(0, params.maxCandidatesHeuristic);
  }
  return candidates;
}

// ─── Hash reproduzível ────────────────────────────────────────────────────────

export function hashDgInput(
  input: DgOptimizationInput,
  params: DgParams,
): string {
  const payload = JSON.stringify({
    poles: input.poles,
    transformer: input.transformer,
    exclusionPolygons: input.exclusionPolygons,
    roadCorridors: input.roadCorridors,
    params,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
