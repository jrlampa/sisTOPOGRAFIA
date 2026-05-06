/**
 * Design Generativo — Excentricidade e Baricentro
 */

import { euclideanDistanceM } from "./dgCandidates.js";

export interface EccentricityResult {
  position: { x: number; y: number };
  adjusted: boolean;
  maxDistM: number;
}

/**
 * Se o trafo em `centroid` tiver algum poste a mais de `maxDistM`,
 * arrasta-o para o poste existente que minimiza a excentricidade máxima.
 * Máximo de 2 tentativas de re-posicionamento.
 */
export function applyEccentricityDrag(
  centroid: { x: number; y: number },
  polesUtm: Array<{ id: string; positionUtm: { x: number; y: number } }>,
  maxDistM = 200,
): EccentricityResult {
  const computeMaxDist = (pos: { x: number; y: number }) =>
    Math.max(...polesUtm.map((p) => euclideanDistanceM(pos, p.positionUtm)));

  const maxDist = computeMaxDist(centroid);
  if (maxDist <= maxDistM) {
    return { position: centroid, adjusted: false, maxDistM: maxDist };
  }

  // Encontra o poste mais afastado e a direção do vetor
  const farthest = polesUtm.reduce((acc, p) =>
    euclideanDistanceM(centroid, p.positionUtm) >
    euclideanDistanceM(centroid, acc.positionUtm)
      ? p
      : acc,
  );
  const dx = farthest.positionUtm.x - centroid.x;
  const dy = farthest.positionUtm.y - centroid.y;

  // Ordena postes por projeção escalar na direção do farthest
  // (postes "na mesma direção" ficam no topo)
  const scored = polesUtm
    .map((p) => ({
      p,
      score:
        (p.positionUtm.x - centroid.x) * dx +
        (p.positionUtm.y - centroid.y) * dy,
    }))
    .sort((a, b) => b.score - a.score);

  // Tenta até 3 postes candidatos na direção do farthest
  for (const { p } of scored.slice(0, 3)) {
    const newMaxDist = computeMaxDist(p.positionUtm);
    if (newMaxDist <= maxDistM) {
      return { position: p.positionUtm, adjusted: true, maxDistM: newMaxDist };
    }
  }

  // Fallback: poste que minimiza a excentricidade máxima globalmente
  const best = polesUtm.reduce(
    (acc, p) => {
      const d = computeMaxDist(p.positionUtm);
      return d < acc.maxDist ? { p, maxDist: d } : acc;
    },
    { p: polesUtm[0], maxDist: computeMaxDist(polesUtm[0].positionUtm) },
  );
  return {
    position: best.p.positionUtm,
    adjusted: true,
    maxDistM: best.maxDist,
  };
}
