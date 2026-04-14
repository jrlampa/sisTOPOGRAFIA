/**
 * Item 8 – Validador de Topologia de Rede em Tempo Real
 *
 * Valida grafos de rede elétrica/hídrica: nós e arestas.
 * Detecta: nós órfãos, subgrafos desconectados, arestas duplicadas,
 * referências de nós ausentes.
 */

import { logger } from "../utils/logger.js";

// ── Tipos de domínio ──────────────────────────────────────────────────────────

export interface TopologyNode {
  id: string;
  lat: number;
  lng: number;
  elevation?: number;
  label?: string;
}

export interface TopologyEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  length?: number;
  type?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NetworkIntegrityResult extends ValidationResult {
  durationMs: number;
  nodeCount: number;
  edgeCount: number;
  componentCount: number;
}

// ── Funções de validação internas ─────────────────────────────────────────────

/** Verifica se todos os nodeIds referenciados nas arestas existem no conjunto de nós. */
function checkMissingNodeReferences(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  errors: string[],
): Set<string> {
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(
        `Aresta "${edge.id}": nó de origem "${edge.fromNodeId}" não encontrado`,
      );
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(
        `Aresta "${edge.id}": nó de destino "${edge.toNodeId}" não encontrado`,
      );
    }
  }

  return nodeIds;
}

/** Detecta arestas duplicadas (mesmo par fromNodeId/toNodeId, ignorando direção). */
function checkDuplicateEdges(edges: TopologyEdge[], warnings: string[]): void {
  const seen = new Set<string>();

  for (const edge of edges) {
    // Normaliza direção para detectar duplicatas bidirecionais
    const key =
      edge.fromNodeId < edge.toNodeId
        ? `${edge.fromNodeId}::${edge.toNodeId}`
        : `${edge.toNodeId}::${edge.fromNodeId}`;

    if (seen.has(key)) {
      warnings.push(
        `Aresta duplicada detectada entre "${edge.fromNodeId}" e "${edge.toNodeId}" (aresta "${edge.id}")`,
      );
    } else {
      seen.add(key);
    }
  }
}

/**
 * Union-Find para detectar componentes conectados.
 * Retorna o número de componentes e o conjunto de nós órfãos.
 */
function analyzeConnectivity(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
): { componentCount: number; orphanedNodeIds: string[] } {
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id) ?? id));
    }
    return parent.get(id) ?? id;
  };

  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  };

  // Inicializa cada nó como seu próprio componente
  for (const node of nodes) {
    parent.set(node.id, node.id);
  }

  // Une nós conectados por arestas
  for (const edge of edges) {
    if (parent.has(edge.fromNodeId) && parent.has(edge.toNodeId)) {
      union(edge.fromNodeId, edge.toNodeId);
    }
  }

  // Conta componentes únicos
  const roots = new Set<string>();
  const nodesConnectedToEdge = new Set<string>();

  for (const edge of edges) {
    if (parent.has(edge.fromNodeId)) nodesConnectedToEdge.add(edge.fromNodeId);
    if (parent.has(edge.toNodeId)) nodesConnectedToEdge.add(edge.toNodeId);
  }

  for (const node of nodes) {
    roots.add(find(node.id));
  }

  // Nós órfãos: não aparecem em nenhuma aresta
  const orphanedNodeIds = nodes
    .filter((n) => !nodesConnectedToEdge.has(n.id))
    .map((n) => n.id);

  return { componentCount: roots.size, orphanedNodeIds };
}

/** Valida os limites de coordenadas dos nós. */
function checkCoordinateBounds(
  nodes: TopologyNode[],
  warnings: string[],
): void {
  for (const node of nodes) {
    if (node.lat < -90 || node.lat > 90) {
      warnings.push(
        `Nó "${node.id}": latitude fora do intervalo válido (${node.lat})`,
      );
    }
    if (node.lng < -180 || node.lng > 180) {
      warnings.push(
        `Nó "${node.id}": longitude fora do intervalo válido (${node.lng})`,
      );
    }
    if (node.elevation !== undefined && node.elevation < -500) {
      warnings.push(
        `Nó "${node.id}": elevação suspeita abaixo de -500m (${node.elevation}m)`,
      );
    }
  }
}

/** Valida comprimentos de arestas. */
function checkEdgeLengths(edges: TopologyEdge[], warnings: string[]): void {
  for (const edge of edges) {
    if (edge.length !== undefined) {
      if (edge.length <= 0) {
        warnings.push(
          `Aresta "${edge.id}": comprimento inválido (${edge.length}m)`,
        );
      } else if (edge.length > 50000) {
        warnings.push(
          `Aresta "${edge.id}": comprimento muito grande (${edge.length}m) – verificar`,
        );
      }
    }
  }
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Valida a topologia de rede de forma síncrona.
 * Retorna erros críticos e avisos.
 */
function validateTopology(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    errors.push("Topologia vazia: nenhum nó informado");
    return { valid: false, errors, warnings };
  }

  // IDs de nós duplicados
  const nodeIdsSeen = new Set<string>();
  for (const node of nodes) {
    if (nodeIdsSeen.has(node.id)) {
      errors.push(`ID de nó duplicado: "${node.id}"`);
    }
    nodeIdsSeen.add(node.id);
  }

  // IDs de arestas duplicados
  const edgeIdsSeen = new Set<string>();
  for (const edge of edges) {
    if (edgeIdsSeen.has(edge.id)) {
      errors.push(`ID de aresta duplicado: "${edge.id}"`);
    }
    edgeIdsSeen.add(edge.id);
  }

  // Referências ausentes
  checkMissingNodeReferences(nodes, edges, errors);

  // Arestas paralelas
  checkDuplicateEdges(edges, warnings);

  // Coordenadas
  checkCoordinateBounds(nodes, warnings);

  // Comprimentos
  checkEdgeLengths(edges, warnings);

  // Conectividade
  const { orphanedNodeIds, componentCount } = analyzeConnectivity(
    nodes,
    edges,
  );

  if (orphanedNodeIds.length > 0) {
    warnings.push(
      `Nós órfãos (sem conexão): [${orphanedNodeIds.slice(0, 10).join(", ")}]` +
        (orphanedNodeIds.length > 10
          ? ` ... e mais ${orphanedNodeIds.length - 10}`
          : ""),
    );
  }

  if (componentCount > 1 && nodes.length > 1) {
    warnings.push(
      `Topologia desconectada: ${componentCount} subgrafos isolados detectados`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Versão assíncrona com métricas de tempo de execução.
 * Indica se a rede é íntegra e inclui estatísticas de diagnóstico.
 */
async function validateNetworkIntegrity(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
): Promise<NetworkIntegrityResult> {
  const start = Date.now();

  const base = validateTopology(nodes, edges);

  const { componentCount } = analyzeConnectivity(nodes, edges);
  const durationMs = Date.now() - start;

  logger.info("Validação de topologia concluída", {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    valid: base.valid,
    errorCount: base.errors.length,
    warningCount: base.warnings.length,
    durationMs,
    componentCount,
  });

  return {
    ...base,
    durationMs,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    componentCount,
  };
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const topologyValidatorService = {
  validateTopology,
  validateNetworkIntegrity,
} as const;
