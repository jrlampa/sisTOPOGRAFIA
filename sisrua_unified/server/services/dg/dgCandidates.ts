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
 *
 * Referências:
 *   - Weiszfeld, E. (1937) – algoritmo iterativo para Fermat-Weber.
 *   - docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – regras do sistema.
 */

import crypto from 'crypto';
import type { DgPoleInput, DgCandidate, DgPoint, DgLatLon, DgParams } from './dgTypes.js';

// ─── Conversão geodésica (aproximação UTM zona 23S, SIRGAS 2000) ──────────────

/** Raio médio da Terra (m). */
const EARTH_RADIUS_M = 6_371_000;
/** Longitude central zona 23S (deg). */
const ZONE_23S_CENTRAL_MERIDIAN_DEG = -45;

/**
 * Converte lat/lon (graus) para UTM aproximado (metros, zona 23S).
 * Precisão suficiente para redes BT (<50 km de extensão).
 */
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
            0.0000026390 * Math.sin(4 * latRad));

    const x =
        0.9996 *
            N *
            (A +
                ((1 - T + C) * A ** 3) / 6 +
                ((5 - 18 * T + T ** 2 + 72 * C - 58 * 0.006739496) * A ** 5) /
                    120) +
        500_000;

    const y =
        0.9996 *
            (M +
                N * Math.tan(latRad) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
                    ((61 - 58 * T + T ** 2 + 600 * C - 330 * 0.006739496) * A ** 6) / 720)) +
        (lat < 0 ? 10_000_000 : 0);

    return { x, y };
}

/** Converte UTM zona 23S de volta para lat/lon (aproximado). */
export function utmToLatLon(x: number, y: number): DgLatLon {
    const x0 = x - 500_000;
    const y0 = y - (y > 5_000_000 ? 10_000_000 : 0);

    const M = y0 / 0.9996;
    const mu = M / (EARTH_RADIUS_M * 0.9983243);
    const phi1 = mu + (3 / 2) * 0.001679 * Math.sin(2 * mu);
    const N1 = EARTH_RADIUS_M / Math.sqrt(1 - 0.00669438 * Math.sin(phi1) ** 2);
    const T1 = Math.tan(phi1) ** 2;
    const C1 = 0.006739496 * Math.cos(phi1) ** 2;
    const R1 = (EARTH_RADIUS_M * (1 - 0.00669438)) / (1 - 0.00669438 * Math.sin(phi1) ** 2) ** 1.5;
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

// ─── Distância euclidiana no plano UTM ────────────────────────────────────────

export function euclideanDistanceM(a: DgPoint, b: DgPoint): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Algoritmo de Weiszfeld (Fermat-Weber iterativo) ─────────────────────────

const WEISZFELD_MAX_ITER = 500;
const WEISZFELD_TOLERANCE_M = 0.01; // 1 cm

/**
 * Calcula o centro de carga de Fermat-Weber via algoritmo de Weiszfeld.
 *
 * Minimiza: Σ(w_i × d(p, x_i))
 * onde w_i = demandKva do poste i e x_i = posição UTM do poste i.
 *
 * @returns Posição ótima (UTM) que minimiza a soma ponderada de distâncias.
 */
export function fermatWeberCenter(poles: Array<{ positionUtm: DgPoint; demandKva: number }>): DgPoint {
    if (poles.length === 0) throw new Error('DG: nenhum poste fornecido para Fermat-Weber');
    if (poles.length === 1) return { ...poles[0].positionUtm };

    // Inicializar com centróide ponderado
    const totalDemand = poles.reduce((s, p) => s + p.demandKva, 0);
    let x = poles.reduce((s, p) => s + p.positionUtm.x * p.demandKva, 0) / totalDemand;
    let y = poles.reduce((s, p) => s + p.positionUtm.y * p.demandKva, 0) / totalDemand;

    for (let iter = 0; iter < WEISZFELD_MAX_ITER; iter++) {
        let numeratorX = 0;
        let numeratorY = 0;
        let denominator = 0;

        for (const pole of poles) {
            const d = euclideanDistanceM({ x, y }, pole.positionUtm);
            if (d < 1e-6) continue; // evitar divisão por zero quando p ≡ xi
            const wi = pole.demandKva / d;
            numeratorX += wi * pole.positionUtm.x;
            numeratorY += wi * pole.positionUtm.y;
            denominator += wi;
        }

        if (denominator < 1e-10) break;

        const newX = numeratorX / denominator;
        const newY = numeratorY / denominator;

        const delta = euclideanDistanceM({ x, y }, { x: newX, y: newY });
        x = newX;
        y = newY;

        if (delta < WEISZFELD_TOLERANCE_M) break;
    }

    return { x, y };
}

// ─── Soma ponderada de distâncias (valor objetivo Fermat-Weber) ───────────────

function weightedDistanceSum(position: DgPoint, poles: Array<{ positionUtm: DgPoint; demandKva: number }>): number {
    return poles.reduce((s, p) => s + p.demandKva * euclideanDistanceM(position, p.positionUtm), 0);
}

// ─── Geração de candidatos ─────────────────────────────────────────────────────

/**
 * Gera lista de posições candidatas para o trafo.
 *
 * Estratégia:
 *   1. Sempre inclui o centro de Fermat-Weber.
 *   2. Adiciona todos os postes existentes (Modo A).
 *   3. Se allowNewPoles, adiciona grade de pontos ao redor do FW center.
 *   4. Inclui o centróide simples como fallback.
 */
export function generateCandidates(
    poles: DgPoleInput[],
    params: DgParams,
): DgCandidate[] {
    if (poles.length === 0) return [];

    const polesWithUtm = poles.map((p) => ({
        ...p,
        positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));

    const candidates: DgCandidate[] = [];
    let seq = 0;

    const makeId = (source: string) => `cand-${source}-${++seq}`;

    // ── 1. Centro de Fermat-Weber ─────────────────────────────────────────────
    const fwUtm = fermatWeberCenter(polesWithUtm);
    const fwLatLon = utmToLatLon(fwUtm.x, fwUtm.y);
    candidates.push({
        candidateId: makeId('fw'),
        position: fwLatLon,
        positionUtm: fwUtm,
        weightedDistanceSum: weightedDistanceSum(fwUtm, polesWithUtm),
        source: 'fermat_weber',
    });

    // ── 2. Centróide simples ──────────────────────────────────────────────────
    const cx = polesWithUtm.reduce((s, p) => s + p.positionUtm.x, 0) / polesWithUtm.length;
    const cy = polesWithUtm.reduce((s, p) => s + p.positionUtm.y, 0) / polesWithUtm.length;
    const centroidUtm: DgPoint = { x: cx, y: cy };
    const centroidLatLon = utmToLatLon(cx, cy);
    candidates.push({
        candidateId: makeId('centroid'),
        position: centroidLatLon,
        positionUtm: centroidUtm,
        weightedDistanceSum: weightedDistanceSum(centroidUtm, polesWithUtm),
        source: 'centroid',
    });

    // ── 3. Postes existentes como candidatos (Modo A) ─────────────────────────
    for (const pole of polesWithUtm) {
        candidates.push({
            candidateId: makeId('pole'),
            position: pole.position,
            positionUtm: pole.positionUtm,
            weightedDistanceSum: weightedDistanceSum(pole.positionUtm, polesWithUtm),
            source: 'existing_pole',
        });
    }

    // ── 4. Grade ao redor do FW center (Modo B – novos postes) ────────────────
    if (params.allowNewPoles) {
        const gridRadius = params.maxSpanMeters * 3;
        const gridStep = params.maxSpanMeters;
        for (let dx = -gridRadius; dx <= gridRadius; dx += gridStep) {
            for (let dy = -gridRadius; dy <= gridRadius; dy += gridStep) {
                if (dx === 0 && dy === 0) continue; // já temos o FW center
                const gx = fwUtm.x + dx;
                const gy = fwUtm.y + dy;
                const gUtm: DgPoint = { x: gx, y: gy };
                const gLatLon = utmToLatLon(gx, gy);
                candidates.push({
                    candidateId: makeId('grid'),
                    position: gLatLon,
                    positionUtm: gUtm,
                    weightedDistanceSum: weightedDistanceSum(gUtm, polesWithUtm),
                    source: 'grid',
                });
            }
        }
    }

    // Limitar ao máximo configurado no modo heurístico
    if (params.searchMode === 'heuristic' && candidates.length > params.maxCandidatesHeuristic) {
        // Ordenar por weightedDistanceSum (menor = melhor) e pegar os melhores
        candidates.sort((a, b) => a.weightedDistanceSum - b.weightedDistanceSum);
        return candidates.slice(0, params.maxCandidatesHeuristic);
    }

    return candidates;
}

// ─── Hash reproduzível de entrada ─────────────────────────────────────────────

/**
 * Gera hash SHA-256 dos dados de entrada para rastreabilidade e idempotência.
 */
export function hashDgInput(poles: DgPoleInput[], params: DgParams): string {
    const payload = JSON.stringify({ poles, params });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
