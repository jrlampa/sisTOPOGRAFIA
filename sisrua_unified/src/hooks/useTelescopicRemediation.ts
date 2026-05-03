import { useCallback } from "react";
import type { BtTopology, BtEdge } from "../types";
import { ENTITY_ID_PREFIXES } from "../constants/magicNumbers";

/**
 * Catálogo padronizado de condutores de alumínio multiplexado (mm²).
 */
export const STANDARD_CONDUCTORS = [
  "16mm Al",
  "25mm Al",
  "35mm Al",
  "50mm Al",
  "70mm Al",
  "95mm Al",
  "120mm Al",
];

/**
 * Extrai a seção numérica de uma string de condutor (ex: "35mm Al" -> 35).
 */
function getSectionFromConductorName(name: string): number {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function useTelescopicRemediation() {
  /**
   * Encontra o próximo condutor padronizado superior ao atual.
   */
  const getNextUpConductor = useCallback((currentName: string): string | null => {
    const currentSection = getSectionFromConductorName(currentName);
    const next = STANDARD_CONDUCTORS.find(
      (name) => getSectionFromConductorName(name) > currentSection
    );
    return next || null;
  }, []);

  /**
   * Identifica o caminho do transformador até um nó específico.
   * Retorna lista de IDs de arestas.
   */
  const findPathFromTransformer = useCallback(
    (topology: BtTopology, targetPoleId: string): string[] => {
      const trafo = topology.transformers[0];
      if (!trafo) return [];

      // Encontrar o poste onde o trafo está
      const startPole = topology.poles.find(
        (p) =>
          Math.abs(p.lat - trafo.lat) < 0.00001 &&
          Math.abs(p.lng - trafo.lng) < 0.00001
      );
      if (!startPole) return [];

      const edgePath: string[] = [];
      let currentId = targetPoleId;

      // Busca reversa simples (assumindo topologia radial/árvore)
      const maxIter = 100;
      let iter = 0;

      while (currentId !== startPole.id && iter < maxIter) {
        const edge = topology.edges.find((e) => e.toPoleId === currentId);
        if (!edge) break;
        edgePath.unshift(edge.id);
        currentId = edge.fromPoleId;
        iter++;
      }

      return edgePath;
    },
    []
  );

  /**
   * Aplica remediação telescópica:
   * Realiza o upgrade das seções no caminho para reduzir CQT, 
   * garantindo que a regra telescópica seja mantida (pai >= filho).
   */
  const applyTelescopicUpgrade = useCallback(
    (topology: BtTopology, criticalPoleId: string): BtTopology => {
      const pathIds = findPathFromTransformer(topology, criticalPoleId);
      if (pathIds.length === 0) return topology;

      let hasChanges = false;
      const nextEdges = [...topology.edges];

      // Tenta fazer o upgrade do último trecho e propaga para trás
      const lastEdgeIdx = nextEdges.findIndex((e) => e.id === pathIds[pathIds.length - 1]);
      if (lastEdgeIdx === -1) return topology;

      const currentCond = nextEdges[lastEdgeIdx].conductors[0]?.conductorName || STANDARD_CONDUCTORS[0];
      const nextCond = getNextUpConductor(currentCond);

      if (!nextCond) return topology; // Já está no máximo do catálogo

      const nextSection = getSectionFromConductorName(nextCond);

      // Aplica upgrade em cascata (upstream) para manter a propriedade telescópica
      for (const edgeId of pathIds) {
        const idx = nextEdges.findIndex((e) => e.id === edgeId);
        const edge = nextEdges[idx];
        const currentSection = getSectionFromConductorName(
          edge.conductors[0]?.conductorName || ""
        );

        if (currentSection < nextSection) {
          hasChanges = true;
          const ts = Date.now();
          nextEdges[idx] = {
            ...edge,
            edgeChangeFlag: "replace",
            conductors: [
              {
                id: `${ENTITY_ID_PREFIXES.CONDUCTOR}${ts}-${idx}`,
                quantity: 1,
                conductorName: nextCond,
              },
            ],
          };
        }
      }

      if (!hasChanges) return topology;

      return {
        ...topology,
        edges: nextEdges,
      };
    },
    [findPathFromTransformer, getNextUpConductor]
  );

  return {
    applyTelescopicUpgrade,
    getNextUpConductor,
    STANDARD_CONDUCTORS,
  };
}
